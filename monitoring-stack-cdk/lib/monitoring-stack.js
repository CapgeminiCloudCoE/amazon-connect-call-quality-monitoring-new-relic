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
exports.MonitoringStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const streamsgenerator_stack_1 = require("./streamsgenerator-stack");
const metricapi_stack_1 = require("./metricapi-stack");
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const elasticsearch_stack_1 = require("./elasticsearch-stack");
class MonitoringStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const customStreamsUrl = process.env.STREAMS_URL;
        if (customStreamsUrl != undefined &&
            (!customStreamsUrl?.startsWith('https://') || customStreamsUrl.endsWith('/'))) {
            throw (new Error("Custom Streams URL must begin with https:// and not contain trailing slash"));
        }
        const ccpUrl = process.env.CCP_URL;
        if (ccpUrl == undefined
            || !ccpUrl.startsWith('https://')
            || !(ccpUrl.includes('.awsapps.com') || ccpUrl.includes('.my.connect.aws'))
            || !ccpUrl.includes('/ccp-v2')) {
            throw (new Error('CCP URL must be the https:// url to your ccp-v2 softphone'));
        }
        const cfnResponse = process.env.CFN_RESPONSE_DATA === undefined ? '' : process.env.CFN_RESPONSE_DATA;
        const streamsBucket = new s3.Bucket(this, 'StreamsBucket', {
            websiteIndexDocument: 'index.html',
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
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
        const elasticsearchStackDeployment = process.env.SPLUNK_ENDPOINT == undefined ||
            process.env.SPLUNK_ENDPOINT == ''
            ? new elasticsearch_stack_1.ElasticSearchStack(this, 'ElasticsearchStack', {
                ccpUrl,
            })
            : undefined;
        const metricsApiStackDeployment = new metricapi_stack_1.MetricApiStack(this, 'MetricsApiStack', {
            elasticsearchArn: elasticsearchStackDeployment == undefined ? undefined : elasticsearchStackDeployment.elasticsearchArn,
            streamsDistribution: distribution,
            customStreamsUrl: customStreamsUrl
        });
        const streamsApiDeployment = new streamsgenerator_stack_1.StreamsGeneratorStack(this, 'DynamicFrontendStack', {
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
                CFN_RESPONSE_PAYLOAD: cfnResponse,
                COGNITO_URL: elasticsearchStackDeployment == undefined ? "" : elasticsearchStackDeployment.getUserCreateUrl(),
                KIBANA_URL: elasticsearchStackDeployment == undefined ? "" : elasticsearchStackDeployment.getKibanaUrl(),
                CLOUDFRONT_URL: distribution.distributionDomainName,
            },
            timeout: aws_cdk_lib_1.Duration.minutes(2),
        });
        sarStackConfirmer.node.addDependency(streamsApiDeployment);
        if (elasticsearchStackDeployment != undefined) {
            sarStackConfirmer.node.addDependency(elasticsearchStackDeployment);
        }
        sarStackConfirmer.node.addDependency(metricsApiStackDeployment);
        const provider = new cr.Provider(this, 'SAR Custom Resource Confirmer Provider', {
            onEventHandler: sarStackConfirmer,
        });
        new aws_cdk_lib_1.CustomResource(this, 'SAR Custom Resource Confirmer Trigger', {
            serviceToken: provider.serviceToken,
        });
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFFQUFxRTtBQUNyRSxpQ0FBaUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVqQyw2Q0FBOEY7QUFFOUYscUVBQWlFO0FBQ2pFLHVEQUFtRDtBQUNuRCx1RUFBeUQ7QUFDekQsNEVBQThEO0FBQzlELGlFQUFtRDtBQUNuRCwrREFBaUQ7QUFDakQsdURBQXlDO0FBQ3pDLHdFQUEwRDtBQUMxRCwrREFBMkQ7QUFFM0QsTUFBYSxlQUFnQixTQUFRLG1CQUFLO0lBQ3hDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBa0I7UUFDMUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQztRQUNqRCxJQUFJLGdCQUFnQixJQUFJLFNBQVM7WUFDL0IsQ0FBQyxDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2hGLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDLENBQUM7UUFDbEcsQ0FBQztRQUNELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBUSxDQUFDO1FBQ3BDLElBQ0UsTUFBTSxJQUFJLFNBQVM7ZUFDaEIsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQztlQUM5QixDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUM7ZUFDeEUsQ0FBQyxNQUFNLENBQUMsUUFBUSxD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QyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxZQUFZLEVBQUU7Z0JBQ3hHLGNBQWMsRUFBRSxZQUFZLENBQUMsc0JBQXNCO2FBQ3BEO1lBQ0QsT0FBTyxFQUFFLHNCQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUM3QixDQUFDLENBQUM7UUFFSCxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDM0QsSUFBSSw0QkFBNEIsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUM5QyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDckUsQ0FBQztRQUNELGlCQUFpQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUVoRSxNQUFNLFFBQVEsR0FBRyxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHdDQUF3QyxFQUFFO1lBQy9FLGNBQWMsRUFBRSxpQkFBaUI7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSw0QkFBYyxDQUFDLElBQUksRUFBRSx1Q0FBdUMsRUFBRTtZQUNoRSxZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVk7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBeEZELDBDQXdGQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuLy8gU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IE1JVC0wXG5cbmltcG9ydCB7IEFwcCwgU3RhY2ssIFN0YWNrUHJvcHMsIER1cmF0aW9uLCBSZW1vdmFsUG9saWN5LCBDdXN0b21SZXNvdXJjZSB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU3RyZWFtc0dlbmVyYXRvclN0YWNrIH0gZnJvbSAnLi9zdHJlYW1zZ2VuZXJhdG9yLXN0YWNrJztcbmltcG9ydCB7IE1ldHJpY0FwaVN0YWNrIH0gZnJvbSAnLi9tZXRyaWNhcGktc3RhY2snO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgY3IgZnJvbSAnYXdzLWNkay1saWIvY3VzdG9tLXJlc291cmNlcyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgczNkZXBsb3kgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzLWRlcGxveW1lbnQnO1xuaW1wb3J0IHsgRWxhc3RpY1NlYXJjaFN0YWNrIH0gZnJvbSAnLi9lbGFzdGljc2VhcmNoLXN0YWNrJztcblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmdTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBjdXN0b21TdHJlYW1zVXJsID0gcHJvY2Vzcy5lbnYuU1RSRUFNU19VUkw7XG4gICAgaWYgKGN1c3RvbVN0cmVhbXNVcmwgIT0gdW5kZWZpbmVkICYmXG4gICAgICAoIWN1c3RvbVN0cmVhbXNVcmw/LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgY3VzdG9tU3RyZWFtc1VybC5lbmRzV2l0aCgnLycpKSkge1xuICAgICAgdGhyb3cgKG5ldyBFcnJvcihcIkN1c3RvbSBTdHJlYW1zIFVSTCBtdXN0IGJlZ2luIHdpdGggaHR0cHM6Ly8gYW5kIG5vdCBjb250YWluIHRyYWlsaW5nIHNsYXNoXCIpKTtcbiAgICB9XG4gICAgY29uc3QgY2NwVXJsID0gcHJvY2Vzcy5lbnYuQ0NQX1VSTCE7XG4gICAgaWYgKFxuICAgICAgY2NwVXJsID09IHVuZGVmaW5lZFxuICAgICAgfHwgIWNjcFVybC5zdGFydHNXaXRoKCdodHRwczovLycpXG4gICAgICB8fCAhKGNjcFVybC5pbmNsdWRlcygnLmF3c2FwcHMuY29tJykgfHwgY2NwVXJsLmluY2x1ZGVzKCcubXkuY29ubmVjdC5hd3MnKSlcbiAgICAgIHx8ICFjY3BVcmwuaW5jbHVkZXMoJy9jY3AtdjInKSkge1xuICAgICAgdGhyb3cgKG5ldyBFcnJvcignQ0NQIFVSTCBtdXN0IGJlIHRoZSBodHRwczovLyB1cmwgdG8geW91ciBjY3AtdjIgc29mdHBob25lJykpO1xuICAgIH1cbiAgICBjb25zdCBjZm5SZXNwb25zZSA9IHByb2Nlc3MuZW52LkNGTl9SRVNQT05TRV9EQVRBID09PSB1bmRlZmluZWQgPyAnJyA6IHByb2Nlc3MuZW52LkNGTl9SRVNQT05TRV9EQVRBO1xuICAgIGNvbnN0IHN0cmVhbXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTdHJlYW1zQnVja2V0Jywge1xuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICB9KTtcbiAgICBjb25zdCBzdHJlYW1zQXNzZXQgPSBzM2RlcGxveS5Tb3VyY2UuYXNzZXQoJy4vcmVzb3VyY2VzL2Zyb250ZW5kJyk7XG4gICAgY29uc3Qgc3RyZWFtc0Rpc3RyaWJ1dGlvbk9haSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsICdTdHJlYW1zQnVja2V0T0FJJywge30pO1xuXG4gICAgLy8gR3JhbnQgdGhlIENsb3VkRnJvbnQgT0FJIHJlYWQgYWNjZXNzIHRvIHRoZSBidWNrZXRcbiAgICBzdHJlYW1zQnVja2V0LmdyYW50UmVhZChzdHJlYW1zRGlzdHJpYnV0aW9uT2FpKTtcblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnU3RyZWFtc0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHN0cmVhbXNCdWNrZXQsIHtcbiAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogc3RyZWFtc0Rpc3RyaWJ1dGlvbk9haVxuICAgICAgICB9KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFNcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IGVsYXN0aWNzZWFyY2hTdGFja0RlcGxveW1lbnQgPVxuICAgICAgcHJvY2Vzcy5lbnYuU1BMVU5LX0VORFBPSU5UID09IHVuZGVmaW5lZCB8fFxuICAgICAgICBwcm9jZXNzLmVudi5TUExVTktfRU5EUE9JTlQgPT0gJydcbiAgICAgICAgPyBuZXcgRWxhc3RpY1NlYXJjaFN0YWNrKHRoaXMsICdFbGFzdGljc2VhcmNoU3RhY2snLCB7XG4gICAgICAgICAgY2NwVXJsLFxuICAgICAgICB9KVxuICAgICAgICA6IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IG1ldHJpY3NBcGlTdGFja0RlcGxveW1lbnQgPSBuZXcgTWV0cmljQXBpU3RhY2sodGhpcywgJ01ldHJpY3NBcGlTdGFjaycsIHtcbiAgICAgIGVsYXN0aWNzZWFyY2hBcm46IGVsYXN0aWNzZWFyY2hTdGFja0RlcGxveW1lbnQgPT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZWxhc3RpY3NlYXJjaFN0YWNrRGVwbG95bWVudC5lbGFzdGljc2VhcmNoQXJuLFxuICAgICAgc3RyZWFtc0Rpc3RyaWJ1dGlvbjogZGlzdHJpYnV0aW9uLFxuICAgICAgY3VzdG9tU3RyZWFtc1VybDogY3VzdG9tU3RyZWFtc1VybFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3RyZWFtc0FwaURlcGxveW1lbnQgPSBuZXcgU3RyZWFtc0dlbmVyYXRvclN0YWNrKHRoaXMsICdEeW5hbWljRnJvbnRlbmRTdGFjaycsIHtcbiAgICAgIGFwaTogbWV0cmljc0FwaVN0YWNrRGVwbG95bWVudC5hcGksXG4gICAgICBjY3BVcmwsXG4gICAgICBzdHJlYW1zQXNzZXQsXG4gICAgICBzdHJlYW1zQnVja2V0LFxuICAgICAgc3RyZWFtc0Rpc3RyaWJ1dGlvbjogZGlzdHJpYnV0aW9uLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2FyU3RhY2tDb25maXJtZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTQVIgQ3VzdG9tIFJlc291cmNlIENvbmZpcm1lcicsIHtcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuL3Jlc291cmNlcy9jdXN0b20tcmVzb3VyY2VzL3Nhci1jb25maXJtZXInKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIENGTl9SRVNQT05TRV9QQVlMT0FEOiBjZm5SZXNwb25zZSEsXG4gICAgICAgIENPR05JVE9fVVJMOiBlbGFzdGljc2VhcmNoU3RhY2tEZXBsb3ltZW50ID09IHVuZGVmaW5lZCA/IFwiXCIgOiBlbGFzdGljc2VhcmNoU3RhY2tEZXBsb3ltZW50LmdldFVzZXJDcmVhdGVVcmwoKSxcbiAgICAgICAgS0lCQU5BX1VSTDogZWxhc3RpY3NlYXJjaFN0YWNrRGVwbG95bWVudCA9PSB1bmRlZmluZWQgPyBcIlwiIDogZWxhc3RpY3NlYXJjaFN0YWNrRGVwbG95bWVudC5nZXRLaWJhbmFVcmwoKSxcbiAgICAgICAgQ0xPVURGUk9OVF9VUkw6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMiksXG4gICAgfSk7XG5cbiAgICBzYXJTdGFja0NvbmZpcm1lci5ub2RlLmFkZERlcGVuZGVuY3koc3RyZWFtc0FwaURlcGxveW1lbnQpO1xuICAgIGlmIChlbGFzdGljc2VhcmNoU3RhY2tEZXBsb3ltZW50ICE9IHVuZGVmaW5lZCkge1xuICAgICAgc2FyU3RhY2tDb25maXJtZXIubm9kZS5hZGREZXBlbmRlbmN5KGVsYXN0aWNzZWFyY2hTdGFja0RlcGxveW1lbnQpO1xuICAgIH1cbiAgICBzYXJTdGFja0NvbmZpcm1lci5ub2RlLmFkZERlcGVuZGVuY3kobWV0cmljc0FwaVN0YWNrRGVwbG95bWVudCk7XG5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBjci5Qcm92aWRlcih0aGlzLCAnU0FSIEN1c3RvbSBSZXNvdXJjZSBDb25maXJtZXIgUHJvdmlkZXInLCB7XG4gICAgICBvbkV2ZW50SGFuZGxlcjogc2FyU3RhY2tDb25maXJtZXIsXG4gICAgfSk7XG5cbiAgICBuZXcgQ3VzdG9tUmVzb3VyY2UodGhpcywgJ1NBUiBDdXN0b20gUmVzb3VyY2UgQ29uZmlybWVyIFRyaWdnZXInLCB7XG4gICAgICBzZXJ2aWNlVG9rZW46IHByb3ZpZGVyLnNlcnZpY2VUb2tlbixcbiAgICB9KTtcbiAgfVxufSJdfQ==