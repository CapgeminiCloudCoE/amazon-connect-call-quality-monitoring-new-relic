"use strict";
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentCdkResourcesStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const codebuild = __importStar(require("aws-cdk-lib/aws-codebuild"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const fs = __importStar(require("fs"));
const buildSpecJson = require('../resources/buildspec/buildspec.json');
/**
 * TODO: Clean up strings and raw json into files in /lib/static
 */
class DeploymentCdkResourcesStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        aws_cdk_lib_1.Stack.of(this).addTransform('AWS::Serverless-2016-10-31');
        const ccpUrlParameter = new aws_cdk_lib_1.CfnParameter(this, 'CcpUrl', {
            type: "String",
            description: "The URL of your softphone."
        });
        const samlUrlParameter = new aws_cdk_lib_1.CfnParameter(this, 'SamlUrl', {
            type: "String",
            description: "The SAML URL for your instance. Leave empty if you aren't using SAML.",
            default: ''
        });
        const splunkUrlParameter = new aws_cdk_lib_1.CfnParameter(this, 'SplunkUrl', {
            type: "String",
            description: "The Splunk URL to send data to. Leave empty if you aren't using Splunk.",
            default: ''
        });
        const splunkTokenParameter = new aws_cdk_lib_1.CfnParameter(this, 'SplunkToken', {
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
                "CCP_URL": { value: ccpUrlParameter.valueAsString },
                "SAML_URL": { value: samlUrlParameter.valueAsString },
                "SPLUNK_ENDPOINT": { value: splunkUrlParameter.valueAsString },
                "SPLUNK_TOKEN": { value: splunkTokenParameter.valueAsString }
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
        const suffix = aws_cdk_lib_1.Fn.select(3, aws_cdk_lib_1.Fn.split('-', aws_cdk_lib_1.Fn.select(2, aws_cdk_lib_1.Fn.split('/', this.stackId))));
        const codeBuildPolicy = new iam.ManagedPolicy(this, 'CDK Deployer Policy', {
            managedPolicyName: 'ConnectMonitoringArtifactAccess' + suffix
        });
        codeBuildPolicy.addStatements(new iam.PolicyStatement({
            actions: ["firehose:*"],
            resources: ["*"],
            effect: iam.Effect.ALLOW
        }), new iam.PolicyStatement({
            actions: [
                "s3:GetObject",
                "s3:ListBucket",
                "s3:GetObjectVersion"
            ],
            resources: ["arn:aws:s3:::amazon-connect-monitoring-test-artifact-bucket"],
            effect: iam.Effect.ALLOW
        }), new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["apigateway:*"],
            resources: ["arn:aws:apigateway:*::/*"]
        }), new iam.PolicyStatement({
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
        }));
        managedPolicies.forEach(function (policyName) {
            cdkProject.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(policyName));
        });
        codeBuildPolicy.attachToRole(cdkProject.role);
        const codeBuildTrigger = new lambda.Function(this, "Code Build Trigger", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromInline(fs.readFileSync('./resources/lambda-functions/cdk-builder/cdkBuilder.js', 'utf-8')),
            handler: 'index.handler',
            environment: {
                'ProjectName': cdkProject.projectName
            },
            timeout: aws_cdk_lib_1.Duration.minutes(15)
        });
        codeBuildTrigger.addToRolePolicy(new iam.PolicyStatement({
            resources: [cdkProject.projectArn],
            actions: ["codebuild:StartBuild"]
        }));
        const provider = new cr.Provider(this, 'CodeBuildTriggerProvider', {
            onEventHandler: codeBuildTrigger,
        });
        const codeBuildResource = new aws_cdk_lib_1.CustomResource(this, 'CodeBuild Trigger Invoke', {
            serviceToken: provider.serviceToken,
        });
        const name = aws_cdk_lib_1.Stack.of(this).stackName;
        this.generateOutputAndParam(`UserCreationUrl-${name}`, 'CognitoUrl', codeBuildResource);
        this.generateOutputAndParam(`KibanaUrl-${name}`, 'KibanaUrl', codeBuildResource);
        this.generateOutputAndParam(`CloudfrontUrl-${name}`, 'CloudfrontUrl', codeBuildResource);
    }
    generateOutputAndParam(parameterName, attributeName, codeBuildResource) {
        const attributeValue = codeBuildResource.getAttString(attributeName);
        new aws_cdk_lib_1.CfnOutput(this, parameterName, {
            value: attributeValue
        });
        new ssm.StringParameter(this, `ssm-${parameterName}`, {
            parameterName: parameterName,
            stringValue: attributeValue
        });
    }
}
exports.DeploymentCdkResourcesStack = DeploymentCdkResourcesStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95bWVudC1jZGstcmVzb3VyY2VzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVwbG95bWVudC1jZGstcmVzb3VyY2VzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxxRUFBcUU7QUFDckUsaUNBQWlDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFakMsNkNBU3FCO0FBRXJCLHFFQUF1RDtBQUN2RCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELGlFQUFtRDtBQUNuRCx5REFBMkM7QUFDM0MsdUNBQXlCO0FBQ3pCLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0FBRXZFOztHQUVHO0FBQ0gsTUFBYSwyQkFBNEIsU0FBUSxtQkFBSztJQUNwRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG1CQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBRTFELE1BQU0sZUFBZSxHQUFHLElBQUksMEJBQVksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQ3ZELElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxNQUFNLGdCQUFnQixHQUFHLElBQUksMEJBQVksQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ3pELElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLHVFQUF1RTtZQUNwRixPQUFPLEVBQUUsRUFBRTtTQUNaLENBQUMsQ0FBQztRQUVILE1BQU0sa0JBQWtCLEdBQUcsSUFBSSwwQkFBWSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDN0QsSUFBSSxFQUFFLFFBQVE7WUFDZCxXQUFXLEVBQUUseUVBQXlFO1lBQ3RG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QUFFO1lBQzdFLFlBQVksRUFBRSxRQUFRLENBQUMsWUFBWTtTQUNwQyxDQUFDLENBQUM7UUFFSCxNQUFNLElBQUksR0FBRyxtQkFBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFFdEMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLG1CQUFtQixJQUFJLEVBQUUsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUN4RixJQUFJLENBQUMsc0JBQXNCLENBQUMsYUFBYSxJQUFJLEVBQUUsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUNqRixJQUFJLENBQUMsc0JBQXNCLENBQUMsaUJBQWlCLElBQUksRUFBRSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQzNGLENBQUM7SUFFRCxzQkFBc0IsQ0FBQyxhQUFxQixFQUFFLGFBQXFCLEVBQUUsaUJBQWlDO1FBQ3BHLE1BQU0sY0FBYyxHQUFHLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNyRSxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNqQyxLQUFLLEVBQUUsY0FBYztTQUN0QixDQUFDLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sYUFBYSxFQUFFLEVBQUU7WUFDcEQsYUFBYSxFQUFFLGFBQWE7WUFDNUIsV0FBVyxFQUFFLGNBQWM7U0FDNUIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBckpELGtFQXFKQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuLy8gU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IE1JVC0wXG5cbmltcG9ydCB7IFxuICBTdGFjaywgXG4gIFN0YWNrUHJvcHMsIFxuICBDZm5QYXJhbWV0ZXIsIFxuICBDZm5PdXRwdXQsIFxuICBEdXJhdGlvbiwgXG4gIEZuLCBcbiAgQ2ZuQ3VzdG9tUmVzb3VyY2UsXG4gIEN1c3RvbVJlc291cmNlXG59IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgY29kZWJ1aWxkIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2RlYnVpbGQnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY3IgZnJvbSAnYXdzLWNkay1saWIvY3VzdG9tLXJlc291cmNlcyc7XG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5jb25zdCBidWlsZFNwZWNKc29uID0gcmVxdWlyZSgnLi4vcmVzb3VyY2VzL2J1aWxkc3BlYy9idWlsZHNwZWMuanNvbicpO1xuXG4vKipcbiAqIFRPRE86IENsZWFuIHVwIHN0cmluZ3MgYW5kIHJhdyBqc29uIGludG8gZmlsZXMgaW4gL2xpYi9zdGF0aWNcbiAqL1xuZXhwb3J0IGNsYXNzIERlcGxveW1lbnRDZGtSZXNvdXJjZXNTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgXG4gICAgU3RhY2sub2YodGhpcykuYWRkVHJhbnNmb3JtKCdBV1M6OlNlcnZlcmxlc3MtMjAxNi0xMC0zMScpO1xuXG4gICAgY29uc3QgY2NwVXJsUGFyYW1ldGVyID0gbmV3IENmblBhcmFtZXRlcih0aGlzLCAnQ2NwVXJsJywge1xuICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSBVUkwgb2YgeW91ciBzb2Z0cGhvbmUuXCJcbiAgICB9KTtcblxuICAgIGNvbnN0IHNhbWxVcmxQYXJhbWV0ZXIgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsICdTYW1sVXJsJywge1xuICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSBTQU1MIFVSTCBmb3IgeW91ciBpbnN0YW5jZS4gTGVhdmUgZW1wdHkgaWYgeW91IGFyZW4ndCB1c2luZyBTQU1MLlwiLFxuICAgICAgZGVmYXVsdDogJydcbiAgICB9KTtcblxuICAgIGNvbnN0IHNwbHVua1VybFBhcmFtZXRlciA9IG5ldyBDZm5QYXJhbWV0ZXIodGhpcywgJ1NwbHVua1VybCcsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJUaGUgU3BsdW5rIFVSTCB0byBzZW5kIGRhdGEgdG8uIExlYXZlIGVtcHR5IGlmIHlvdSBhcmVuJ3QgdXNpbmcgU3BsdW5rLlwiLFxuICAgICAgZGVmYXVsdDogJydcbiAgICB9KTtcblxuICAgIGNvbnN0IHNwbHVua1Rva2VuUGFyYW1ldGVyID0gbmV3IENmblBhcmFtZXRlcih0aGlzLCAnU3BsdW5rVG9rZW4nLCB7XG4gICAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91ciBTcGx1bmsgSEVDIHRva2VuLiBMZWF2ZSBlbXB0eSBpZiB5b3UgYXJlbid0IHVzaW5nIFNwbHVua1wiLFxuICAgICAgZGVmYXVsdDogJydcbiAgICB9KTtcblxuICAgIGNvbnN0IGNka1Byb2plY3QgPSBuZXcgY29kZWJ1aWxkLlByb2plY3QodGhpcywgJ0NESyBCdWlsZGVyJywge1xuICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3QoYnVpbGRTcGVjSnNvbiksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBidWlsZEltYWdlOiBjb2RlYnVpbGQuTGludXhCdWlsZEltYWdlLlNUQU5EQVJEXzdfMFxuICAgICAgfSxcbiAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgIFwiQ0NQX1VSTFwiOiB7dmFsdWU6IGNjcFVybFBhcmFtZXRlci52YWx1ZUFzU3RyaW5nfSxcbiAgICAgICAgXCJTQU1MX1VSTFwiOiB7dmFsdWU6IHNhbWxVcmxQYXJhbWV0ZXIudmFsdWVBc1N0cmluZ30sXG4gICAgICAgIFwiU1BMVU5LX0VORFBPSU5UXCI6IHt2YWx1ZTogc3BsdW5rVXJsUGFyYW1ldGVyLnZhbHVlQXNTdHJpbmd9LFxuICAgICAgICBcIlNQTFVOS19UT0tFTlwiOiB7dmFsdWU6IHNwbHVua1Rva2VuUGFyYW1ldGVyLnZhbHVlQXNTdHJpbmd9XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgbWFuYWdlZFBvbGljaWVzID0gW1xuICAgICAgJ0Nsb3VkRnJvbnRGdWxsQWNjZXNzJyxcbiAgICAgICdBV1NDbG91ZEZvcm1hdGlvbkZ1bGxBY2Nlc3MnLFxuICAgICAgJ0FtYXpvbkNvZ25pdG9Qb3dlclVzZXInLFxuICAgICAgJ0Nsb3VkV2F0Y2hMb2dzRnVsbEFjY2VzcycsXG4gICAgICAnQW1hem9uT3BlblNlYXJjaFNlcnZpY2VGdWxsQWNjZXNzJyxcbiAgICAgICdDbG91ZFdhdGNoRXZlbnRzRnVsbEFjY2VzcycsXG4gICAgICAnSUFNRnVsbEFjY2VzcycsXG4gICAgICAnQVdTS2V5TWFuYWdlbWVudFNlcnZpY2VQb3dlclVzZXInLFxuICAgICAgJ0FXU0xhbWJkYV9GdWxsQWNjZXNzJyxcbiAgICBdO1xuXG4gICAgY29uc3Qgc3VmZml4ID0gRm4uc2VsZWN0KDMsIEZuLnNwbGl0KCctJywgRm4uc2VsZWN0KDIsIEZuLnNwbGl0KCcvJywgdGhpcy5zdGFja0lkKSkpKTtcblxuICAgIGNvbnN0IGNvZGVCdWlsZFBvbGljeSA9IG5ldyBpYW0uTWFuYWdlZFBvbGljeSh0aGlzLCAnQ0RLIERlcGxveWVyIFBvbGljeScsIHtcbiAgICAgIG1hbmFnZWRQb2xpY3lOYW1lOiAnQ29ubmVjdE1vbml0b3JpbmdBcnRpZmFjdEFjY2VzcycgKyBzdWZmaXhcbiAgICB9KTtcblxuICAgIGNvZGVCdWlsZFBvbGljeS5hZGRTdGF0ZW1lbnRzKFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXCJmaXJlaG9zZToqXCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPV1xuICAgICAgfSksXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcInMzOkdldE9iamVjdFwiLFxuICAgICAgICAgIFwiczM6TGlzdEJ1Y2tldFwiLFxuICAgICAgICAgIFwiczM6R2V0T2JqZWN0VmVyc2lvblwiXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1wiYXJuOmF3czpzMzo6OmFtYXpvbi1jb25uZWN0LW1vbml0b3JpbmctdGVzdC1hcnRpZmFjdC1idWNrZXRcIl0sXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPV1xuICAgICAgfSksXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7ICBcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXCJhcGlnYXRld2F5OipcIl0sXG4gICAgICAgIHJlc291cmNlczogW1wiYXJuOmF3czphcGlnYXRld2F5Oio6Oi8qXCJdXG4gICAgICB9KSxcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiczM6UHV0T2JqZWN0XCIsXG4gICAgICAgICAgXCJzMzpHZXRPYmplY3RcIixcbiAgICAgICAgICBcInMzOkxpc3RCdWNrZXRcIixcbiAgICAgICAgICBcInMzOkdldEJ1Y2tldExvY2F0aW9uXCIsXG4gICAgICAgICAgXCJzMzpDcmVhdGVCdWNrZXRcIixcbiAgICAgICAgICBcInMzOkdldEVuY3J5cHRpb25Db25maWd1cmF0aW9uXCIsXG4gICAgICAgICAgXCJzMzpQdXRFbmNyeXB0aW9uQ29uZmlndXJhdGlvblwiLFxuICAgICAgICAgIFwiczM6UHV0QnVja2V0VmVyc2lvbmluZ1wiLFxuICAgICAgICAgIFwiczM6R2V0QnVja2V0VmVyc2lvbmluZ1wiLFxuICAgICAgICAgIFwiczM6UHV0QnVja2V0V2Vic2l0ZVwiLFxuICAgICAgICAgIFwiczM6UHV0QnVja2V0UG9saWN5XCIsXG4gICAgICAgICAgXCJzMzpHZXRCdWNrZXRQb2xpY3lcIixcbiAgICAgICAgICBcInMzOlB1dEJ1Y2tldFB1YmxpY0FjY2Vzc0Jsb2NrXCJcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCJhcm46YXdzOnMzOjo6KlwiXSxcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBtYW5hZ2VkUG9saWNpZXMuZm9yRWFjaChmdW5jdGlvbihwb2xpY3lOYW1lKSB7XG4gICAgICBjZGtQcm9qZWN0LnJvbGUhLmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShwb2xpY3lOYW1lKVxuICAgICAgKTtcbiAgICB9KTtcbiAgICBcbiAgICBjb2RlQnVpbGRQb2xpY3kuYXR0YWNoVG9Sb2xlKGNka1Byb2plY3Qucm9sZSEpO1xuXG4gICAgY29uc3QgY29kZUJ1aWxkVHJpZ2dlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJDb2RlIEJ1aWxkIFRyaWdnZXJcIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGZzLnJlYWRGaWxlU3luYygnLi9yZXNvdXJjZXMvbGFtYmRhLWZ1bmN0aW9ucy9jZGstYnVpbGRlci9jZGtCdWlsZGVyLmpzJywgJ3V0Zi04JykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgJ1Byb2plY3ROYW1lJzogY2RrUHJvamVjdC5wcm9qZWN0TmFtZVxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMTUpXG4gICAgfSk7XG4gICAgXG4gICAgY29kZUJ1aWxkVHJpZ2dlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgcmVzb3VyY2VzOiBbY2RrUHJvamVjdC5wcm9qZWN0QXJuXSxcbiAgICAgIGFjdGlvbnM6IFtcImNvZGVidWlsZDpTdGFydEJ1aWxkXCJdXG4gICAgfSkpO1xuXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgY3IuUHJvdmlkZXIodGhpcywgJ0NvZGVCdWlsZFRyaWdnZXJQcm92aWRlcicsIHtcbiAgICAgIG9uRXZlbnRIYW5kbGVyOiBjb2RlQnVpbGRUcmlnZ2VyLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29kZUJ1aWxkUmVzb3VyY2UgPSBuZXcgQ3VzdG9tUmVzb3VyY2UodGhpcywgJ0NvZGVCdWlsZCBUcmlnZ2VyIEludm9rZScsIHtcbiAgICAgIHNlcnZpY2VUb2tlbjogcHJvdmlkZXIuc2VydmljZVRva2VuLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbmFtZSA9IFN0YWNrLm9mKHRoaXMpLnN0YWNrTmFtZTtcblxuICAgIHRoaXMuZ2VuZXJhdGVPdXRwdXRBbmRQYXJhbShgVXNlckNyZWF0aW9uVXJsLSR7bmFtZX1gLCAnQ29nbml0b1VybCcsIGNvZGVCdWlsZFJlc291cmNlKTtcbiAgICB0aGlzLmdlbmVyYXRlT3V0cHV0QW5kUGFyYW0oYEtpYmFuYVVybC0ke25hbWV9YCwgJ0tpYmFuYVVybCcsIGNvZGVCdWlsZFJlc291cmNlKTtcbiAgICB0aGlzLmdlbmVyYXRlT3V0cHV0QW5kUGFyYW0oYENsb3VkZnJvbnRVcmwtJHtuYW1lfWAsICdDbG91ZGZyb250VXJsJywgY29kZUJ1aWxkUmVzb3VyY2UpO1xuICB9XG5cbiAgZ2VuZXJhdGVPdXRwdXRBbmRQYXJhbShwYXJhbWV0ZXJOYW1lOiBzdHJpbmcsIGF0dHJpYnV0ZU5hbWU6IHN0cmluZywgY29kZUJ1aWxkUmVzb3VyY2U6IEN1c3RvbVJlc291cmNlKSB7XG4gICAgY29uc3QgYXR0cmlidXRlVmFsdWUgPSBjb2RlQnVpbGRSZXNvdXJjZS5nZXRBdHRTdHJpbmcoYXR0cmlidXRlTmFtZSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBwYXJhbWV0ZXJOYW1lLCB7XG4gICAgICB2YWx1ZTogYXR0cmlidXRlVmFsdWVcbiAgICB9KTtcbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCBgc3NtLSR7cGFyYW1ldGVyTmFtZX1gLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBwYXJhbWV0ZXJOYW1lLFxuICAgICAgc3RyaW5nVmFsdWU6IGF0dHJpYnV0ZVZhbHVlXG4gICAgfSk7XG4gIH1cbn0iXX0=