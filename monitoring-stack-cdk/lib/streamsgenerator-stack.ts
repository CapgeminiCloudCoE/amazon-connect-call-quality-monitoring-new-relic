// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, Duration, CustomResource } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';

interface StreamsGeneratorStackProps {
  api: apigateway.RestApi;
  ccpUrl: string;
  streamsAsset: s3deploy.ISource;
  streamsBucket: s3.Bucket;
  streamsDistribution: cloudfront.Distribution;
}

export class StreamsGeneratorStack extends Construct {
  constructor(scope: Construct, id: string, props: StreamsGeneratorStackProps) {
    super(scope, id);

    // Deploy the frontend assets to the S3 bucket
    new s3deploy.BucketDeployment(this, 'DeployStreamsAssets', {
      sources: [props.streamsAsset],
      destinationBucket: props.streamsBucket,
    });

    // Create a Lambda function to generate the frontend configuration
    const frontendGeneratorFunction = new lambda.Function(this, 'FrontendGeneratorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('./resources/custom-resources/frontend-generator'),
      timeout: Duration.minutes(5),
      environment: {
        API_URL: props.api.url,
        CCP_URL: props.ccpUrl,
        BUCKET_NAME: props.streamsBucket.bucketName,
      },
    });

    // Grant the Lambda function permissions to write to the S3 bucket
    props.streamsBucket.grantReadWrite(frontendGeneratorFunction);

    // Create a custom resource provider
    const frontendGeneratorProvider = new cr.Provider(this, 'FrontendGeneratorProvider', {
      onEventHandler: frontendGeneratorFunction,
    });

    // Create a custom resource to trigger the frontend generation
    new CustomResource(this, 'FrontendGeneratorResource', {
      serviceToken: frontendGeneratorProvider.serviceToken,
      properties: {
        ApiUrl: props.api.url,
        CcpUrl: props.ccpUrl,
        BucketName: props.streamsBucket.bucketName,
        DistributionDomainName: props.streamsDistribution.distributionDomainName,
        // Add a random value to force the custom resource to run on every deployment
        Random: Math.random().toString(),
      },
    });
  }
}