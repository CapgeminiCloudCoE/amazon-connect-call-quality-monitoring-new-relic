// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { App, Stack, StackProps, Duration, RemovalPolicy, CustomResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StreamsGeneratorStack } from './streamsgenerator-stack';
import { MetricApiStack } from './metricapi-stack';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { ElasticSearchStack } from './elasticsearch-stack';

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const customStreamsUrl = process.env.STREAMS_URL;
    if (customStreamsUrl != undefined &&
      (!customStreamsUrl?.startsWith('https://') || customStreamsUrl.endsWith('/'))) {
      throw (new Error("Custom Streams URL must begin with https:// and not contain trailing slash"));
    }
    const ccpUrl = process.env.CCP_URL!;
    if (
      ccpUrl == undefined
      || !ccpUrl.startsWith('https://')
      || !(ccpUrl.includes('.awsapps.com') || ccpUrl.includes('.my.connect.aws'))
      || !ccpUrl.includes('/ccp-v2')) {
      throw (new Error('CCP URL must be the https:// url to your ccp-v2 softphone'));
    }
    const cfnResponse = process.env.CFN_RESPONSE_DATA === undefined ? '' : process.env.CFN_RESPONSE_DATA;
    const streamsBucket = new s3.Bucket(this, 'StreamsBucket', {
      websiteIndexDocument: 'index.html',
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });
    const streamsAsset = s3deploy.Source.asset('./resources/frontend');
    const streamsDistributionOai = new cloudfront.OriginAccessIdentity(this, 'StreamsBucketOAI', {});

    // Grant the CloudFront OAI read access to the bucket
    streamsBucket.grantRead(streamsDistributionOai);

    const distribution = new cloudfront.Distribution(this, 'StreamsDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(streamsBucket, {
          originAccessIdentity: streamsDistributionOai
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      }
    });

    const elasticsearchStackDeployment =
      process.env.SPLUNK_ENDPOINT == undefined ||
        process.env.SPLUNK_ENDPOINT == ''
        ? new ElasticSearchStack(this, 'ElasticsearchStack', {
          ccpUrl,
        })
        : undefined;

    const metricsApiStackDeployment = new MetricApiStack(this, 'MetricsApiStack', {
      elasticsearchArn: elasticsearchStackDeployment == undefined ? undefined : elasticsearchStackDeployment.elasticsearchArn,
      streamsDistribution: distribution,
      customStreamsUrl: customStreamsUrl
    });

    const streamsApiDeployment = new StreamsGeneratorStack(this, 'DynamicFrontendStack', {
      api: metricsApiStackDeployment.api,
      ccpUrl,
      streamsAsset,
      streamsBucket,
      streamsDistribution: distribution,
    });

    const sarStackConfirmer = new lambda.Function(this, 'SAR Custom Resource Confirmer', {
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('./resources/custom-resources/sar-confirmer'),
      environment: {
        CFN_RESPONSE_PAYLOAD: cfnResponse!,
        COGNITO_URL: elasticsearchStackDeployment == undefined ? "" : elasticsearchStackDeployment.getUserCreateUrl(),
        KIBANA_URL: elasticsearchStackDeployment == undefined ? "" : elasticsearchStackDeployment.getKibanaUrl(),
        CLOUDFRONT_URL: distribution.distributionDomainName,
      },
      timeout: Duration.minutes(2),
    });

    sarStackConfirmer.node.addDependency(streamsApiDeployment);
    if (elasticsearchStackDeployment != undefined) {
      sarStackConfirmer.node.addDependency(elasticsearchStackDeployment);
    }
    sarStackConfirmer.node.addDependency(metricsApiStackDeployment);

    const provider = new cr.Provider(this, 'SAR Custom Resource Confirmer Provider', {
      onEventHandler: sarStackConfirmer,
    });

    new CustomResource(this, 'SAR Custom Resource Confirmer Trigger', {
      serviceToken: provider.serviceToken,
    });
  }
}