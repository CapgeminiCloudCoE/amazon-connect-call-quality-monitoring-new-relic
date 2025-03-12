// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { 
  Stack, 
  StackProps, 
  CfnParameter, 
  CfnOutput, 
  Duration, 
  Fn, 
  CfnCustomResource,
  CustomResource
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as fs from 'fs';
const buildSpecJson = require('../resources/buildspec/buildspec.json');

/**
 * TODO: Clean up strings and raw json into files in /lib/static
 */
export class DeploymentCdkResourcesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    Stack.of(this).addTransform('AWS::Serverless-2016-10-31');

    const ccpUrlParameter = new CfnParameter(this, 'CcpUrl', {
      type: "String",
      description: "The URL of your softphone."
    });

    const samlUrlParameter = new CfnParameter(this, 'SamlUrl', {
      type: "String",
      description: "The SAML URL for your instance. Leave empty if you aren't using SAML.",
      default: ''
    });

    const splunkUrlParameter = new CfnParameter(this, 'SplunkUrl', {
      type: "String",
      description: "The Splunk URL to send data to. Leave empty if you aren't using Splunk.",
      default: ''
    });

    const splunkTokenParameter = new CfnParameter(this, 'SplunkToken', {
      type: "String",
      description: "Your Splunk HEC token. Leave empty if you aren't using Splunk",
      default: ''
    });

    const cdkProject = new codebuild.Project(this, 'CDK Builder', {
      buildSpec: codebuild.BuildSpec.fromObject(buildSpecJson),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0
      },
      environmentVariables: {
        "CCP_URL": {value: ccpUrlParameter.valueAsString},
        "SAML_URL": {value: samlUrlParameter.valueAsString},
        "SPLUNK_ENDPOINT": {value: splunkUrlParameter.valueAsString},
        "SPLUNK_TOKEN": {value: splunkTokenParameter.valueAsString}
      },
    });

    const managedPolicies = [
      'CloudFrontFullAccess',
      'AWSCloudFormationFullAccess',
      'AmazonCognitoPowerUser',
      'CloudWatchLogsFullAccess',
      'AmazonOpenSearchServiceFullAccess',
      'CloudWatchEventsFullAccess',
      'IAMFullAccess',
      'AWSKeyManagementServicePowerUser',
      'AWSLambda_FullAccess',
    ];

    const suffix = Fn.select(3, Fn.split('-', Fn.select(2, Fn.split('/', this.stackId))));

    const codeBuildPolicy = new iam.ManagedPolicy(this, 'CDK Deployer Policy', {
      managedPolicyName: 'ConnectMonitoringArtifactAccess' + suffix
    });

    codeBuildPolicy.addStatements(
      new iam.PolicyStatement({
        actions: ["firehose:*"],
        resources: ["*"],
        effect: iam.Effect.ALLOW
      }),
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:ListBucket",
          "s3:GetObjectVersion"
        ],
        resources: ["arn:aws:s3:::amazon-connect-monitoring-test-artifact-bucket"],
        effect: iam.Effect.ALLOW
      }),
      new iam.PolicyStatement({  
        effect: iam.Effect.ALLOW,
        actions: ["apigateway:*"],
        resources: ["arn:aws:apigateway:*::/*"]
      }),
      new iam.PolicyStatement({
        actions: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:CreateBucket",
          "s3:GetEncryptionConfiguration",
          "s3:PutEncryptionConfiguration",
          "s3:PutBucketVersioning",
          "s3:GetBucketVersioning",
          "s3:PutBucketWebsite",
          "s3:PutBucketPolicy",
          "s3:GetBucketPolicy",
          "s3:PutBucketPublicAccessBlock"
        ],
        resources: ["arn:aws:s3:::*"],
        effect: iam.Effect.ALLOW
      })
    );

    managedPolicies.forEach(function(policyName) {
      cdkProject.role!.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(policyName)
      );
    });
    
    codeBuildPolicy.attachToRole(cdkProject.role!);

    const codeBuildTrigger = new lambda.Function(this, "Code Build Trigger", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromInline(fs.readFileSync('./resources/lambda-functions/cdk-builder/cdkBuilder.js', 'utf-8')),
      handler: 'index.handler',
      environment: {
        'ProjectName': cdkProject.projectName
      },
      timeout: Duration.minutes(15)
    });
    
    codeBuildTrigger.addToRolePolicy(new iam.PolicyStatement({
      resources: [cdkProject.projectArn],
      actions: ["codebuild:StartBuild"]
    }));

    const provider = new cr.Provider(this, 'CodeBuildTriggerProvider', {
      onEventHandler: codeBuildTrigger,
    });

    const codeBuildResource = new CustomResource(this, 'CodeBuild Trigger Invoke', {
      serviceToken: provider.serviceToken,
    });

    const name = Stack.of(this).stackName;

    this.generateOutputAndParam(`UserCreationUrl-${name}`, 'CognitoUrl', codeBuildResource);
    this.generateOutputAndParam(`KibanaUrl-${name}`, 'KibanaUrl', codeBuildResource);
    this.generateOutputAndParam(`CloudfrontUrl-${name}`, 'CloudfrontUrl', codeBuildResource);
  }

  generateOutputAndParam(parameterName: string, attributeName: string, codeBuildResource: CustomResource) {
    const attributeValue = codeBuildResource.getAttString(attributeName);
    new CfnOutput(this, parameterName, {
      value: attributeValue
    });
    new ssm.StringParameter(this, `ssm-${parameterName}`, {
      parameterName: parameterName,
      stringValue: attributeValue
    });
  }
}