// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, Duration, CfnOutput } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { v4 as uuidv4 } from 'uuid';

interface MetricApiStackProps {
  elasticsearchArn?: string;
  streamsDistribution: cloudfront.Distribution;
  customStreamsUrl?: string;
}

export class MetricApiStack extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: MetricApiStackProps) {
    super(scope, id);

    // Create an API Gateway REST API
    this.api = new apigateway.RestApi(this, 'MetricsApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Create a role for the Lambda function
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // If elasticsearch ARN is provided, add permissions to access it
    if (props.elasticsearchArn) {
      lambdaRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['es:ESHttpPost', 'es:ESHttpPut'],
          resources: [props.elasticsearchArn + '/*'],
        })
      );
    }

    // Create a Lambda function for handling softphone metrics
    const softphoneMetricsFunction = new lambda.Function(this, 'SoftphoneMetricsFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset('./resources/lambda-functions/sendSoftPhoneMetricsvenv'),
      timeout: Duration.seconds(30),
      role: lambdaRole,
      environment: {
        CLOUDFRONT_URL: `https://${props.streamsDistribution.distributionDomainName}`,
        ENDPOINT: props.elasticsearchArn ? props.elasticsearchArn.split('/')[1] : '',
        REGION: Stack.of(this).region,
      },
    });

    // Create an API Gateway integration for the Lambda function
    const softphoneMetricsIntegration = new apigateway.LambdaIntegration(softphoneMetricsFunction);

    // Add a resource and method to the API
    const softphoneMetricsResource = this.api.root.addResource('softphone-metrics');
    softphoneMetricsResource.addMethod('POST', softphoneMetricsIntegration);

    // Create a bucket for storing metrics data
    const metricsBucket = new s3.Bucket(this, 'MetricsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // Create a Firehose delivery stream
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    metricsBucket.grantWrite(firehoseRole);

    const firehoseLogGroup = new logs.LogGroup(this, 'FirehoseLogGroup');
    const firehoseLogStream = new logs.LogStream(this, 'FirehoseLogStream', {
      logGroup: firehoseLogGroup,
    });

    firehoseLogGroup.grantWrite(firehoseRole);

    // Create a Firehose delivery stream
    const deliveryStream = new firehose.CfnDeliveryStream(this, 'MetricsDeliveryStream', {
      extendedS3DestinationConfiguration: {
        bucketArn: metricsBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1,
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: firehoseLogGroup.logGroupName,
          logStreamName: firehoseLogStream.logStreamName,
        },
        prefix: 'metrics/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
        errorOutputPrefix: 'errors/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/!{firehose:error-output-type}',
        compressionFormat: 'GZIP',
      },
    });

    // Outputs
    new CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
    });

    new CfnOutput(this, 'MetricsBucketName', {
      value: metricsBucket.bucketName,
    });

    new CfnOutput(this, 'DeliveryStreamName', {
      value: deliveryStream.ref,
    });
  }
}