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
exports.MetricApiStack = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const firehose = __importStar(require("aws-cdk-lib/aws-kinesisfirehose"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class MetricApiStack extends constructs_1.Construct {
    api;
    constructor(scope, id, props) {
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
            lambdaRole.addToPolicy(new iam.PolicyStatement({
                actions: ['es:ESHttpPost', 'es:ESHttpPut'],
                resources: [props.elasticsearchArn + '/*'],
            }));
        }
        // Create a Lambda function for handling softphone metrics
        const softphoneMetricsFunction = new lambda.Function(this, 'SoftphoneMetricsFunction', {
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: 'lambda_function.lambda_handler',
            code: lambda.Code.fromAsset('./resources/lambda-functions/sendSoftPhoneMetricsvenv'),
            timeout: aws_cdk_lib_1.Duration.seconds(30),
            role: lambdaRole,
            environment: {
                CLOUDFRONT_URL: `https://${props.streamsDistribution.distributionDomainName}`,
                ENDPOINT: props.elasticsearchArn ? props.elasticsearchArn.split('/')[1] : '',
                REGION: aws_cdk_lib_1.Stack.of(this).region,
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
        new aws_cdk_lib_1.CfnOutput(this, 'ApiEndpoint', {
            value: this.api.url,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'MetricsBucketName', {
            value: metricsBucket.bucketName,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'DeliveryStreamName', {
            value: deliveryStream.ref,
        });
    }
}
exports.MetricApiStack = MetricApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0cmljYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWV0cmljYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxxRUFBcUU7QUFDckUsaUNBQWlDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFakMsMkNBQXVDO0FBQ3ZDLDZDQUF5RDtBQUN6RCwrREFBaUQ7QUFDakQseURBQTJDO0FBRTNDLHVFQUF5RDtBQUV6RCwwRUFBNEQ7QUFDNUQsdURBQXlDO0FBQ3pDLDJEQUE2QztBQVM3QyxNQUFhLGNBQWUsU0FBUSxzQkFBUztJQUMzQixHQUFHLENBQXFCO0lBRXhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixpQ0FBaUM7UUFDakMsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLENBQUMsY0FBYyxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLHNCQUFzQixDQUFDO2FBQ25HO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ2xELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUMzRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQzthQUN2RjtTQUNGLENBQUMsQ0FB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RSxDQUFDO2lCQUNiO2dCQUNELHdCQUF3QixFQUFFO29CQUN4QixPQUFPLEVBQUUsSUFBSTtvQkFDYixZQUFZLEVBQUUsZ0JBQWdCLENBQUMsWUFBWTtvQkFDM0MsYUFBYSxFQUFFLGlCQUFpQixDQUFDLGFBQWE7aUJBQy9DO2dCQUNELE1BQU0sRUFBRSxnR0FBZ0c7Z0JBQ3hHLGlCQUFpQixFQUFFLDRIQUE0SDtnQkFDL0ksaUJBQWlCLEVBQUUsTUFBTTthQUMxQjtTQUNGLENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNqQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHO1NBQ3BCLENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDdkMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxVQUFVO1NBQ2hDLENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDeEMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxHQUFHO1NBQzFCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTNHRCx3Q0EyR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbi8vIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBNSVQtMFxuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFN0YWNrLCBEdXJhdGlvbiwgQ2ZuT3V0cHV0IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgb3BlbnNlYXJjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtb3BlbnNlYXJjaHNlcnZpY2UnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIGZpcmVob3NlIGZyb20gJ2F3cy1jZGstbGliL2F3cy1raW5lc2lzZmlyZWhvc2UnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgdjQgYXMgdXVpZHY0IH0gZnJvbSAndXVpZCc7XG5cbmludGVyZmFjZSBNZXRyaWNBcGlTdGFja1Byb3BzIHtcbiAgZWxhc3RpY3NlYXJjaEFybj86IHN0cmluZztcbiAgc3RyZWFtc0Rpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIGN1c3RvbVN0cmVhbXNVcmw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBNZXRyaWNBcGlTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTWV0cmljQXBpU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgYW4gQVBJIEdhdGV3YXkgUkVTVCBBUElcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ01ldHJpY3NBcGknLCB7XG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknLCAnWC1BbXotU2VjdXJpdHktVG9rZW4nXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYSByb2xlIGZvciB0aGUgTGFtYmRhIGZ1bmN0aW9uXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIElmIGVsYXN0aWNzZWFyY2ggQVJOIGlzIHByb3ZpZGVkLCBhZGQgcGVybWlzc2lvbnMgdG8gYWNjZXNzIGl0XG4gICAgaWYgKHByb3BzLmVsYXN0aWNzZWFyY2hBcm4pIHtcbiAgICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBhY3Rpb25zOiBbJ2VzOkVTSHR0cFBvc3QnLCAnZXM6RVNIdHRwUHV0J10sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbcHJvcHMuZWxhc3RpY3NlYXJjaEFybiArICcvKiddLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgYSBMYW1iZGEgZnVuY3Rpb24gZm9yIGhhbmRsaW5nIHNvZnRwaG9uZSBtZXRyaWNzXG4gICAgY29uc3Qgc29mdHBob25lTWV0cmljc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU29mdHBob25lTWV0cmljc0Z1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOSxcbiAgICAgIGhhbmRsZXI6ICdsYW1iZGFfZnVuY3Rpb24ubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuL3Jlc291cmNlcy9sYW1iZGEtZnVuY3Rpb25zL3NlbmRTb2Z0UGhvbmVNZXRyaWNzdmVudicpLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQ0xPVURGUk9OVF9VUkw6IGBodHRwczovLyR7cHJvcHMuc3RyZWFtc0Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICAgIEVORFBPSU5UOiBwcm9wcy5lbGFzdGljc2VhcmNoQXJuID8gcHJvcHMuZWxhc3RpY3NlYXJjaEFybi5zcGxpdCgnLycpWzFdIDogJycsXG4gICAgICAgIFJFR0lPTjogU3RhY2sub2YodGhpcykucmVnaW9uLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhbiBBUEkgR2F0ZXdheSBpbnRlZ3JhdGlvbiBmb3IgdGhlIExhbWJkYSBmdW5jdGlvblxuICAgIGNvbnN0IHNvZnRwaG9uZU1ldHJpY3NJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNvZnRwaG9uZU1ldHJpY3NGdW5jdGlvbik7XG5cbiAgICAvLyBBZGQgYSByZXNvdXJjZSBhbmQgbWV0aG9kIHRvIHRoZSBBUElcbiAgICBjb25zdCBzb2Z0cGhvbmVNZXRyaWNzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdzb2Z0cGhvbmUtbWV0cmljcycpO1xuICAgIHNvZnRwaG9uZU1ldHJpY3NSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBzb2Z0cGhvbmVNZXRyaWNzSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gQ3JlYXRlIGEgYnVja2V0IGZvciBzdG9yaW5nIG1ldHJpY3MgZGF0YVxuICAgIGNvbnN0IG1ldHJpY3NCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdNZXRyaWNzQnVja2V0Jywge1xuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGEgRmlyZWhvc2UgZGVsaXZlcnkgc3RyZWFtXG4gICAgY29uc3QgZmlyZWhvc2VSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdGaXJlaG9zZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZmlyZWhvc2UuYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgbWV0cmljc0J1Y2tldC5ncmFudFdyaXRlKGZpcmVob3NlUm9sZSk7XG5cbiAgICBjb25zdCBmaXJlaG9zZUxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0ZpcmVob3NlTG9nR3JvdXAnKTtcbiAgICBjb25zdCBmaXJlaG9zZUxvZ1N0cmVhbSA9IG5ldyBsb2dzLkxvZ1N0cmVhbSh0aGlzLCAnRmlyZWhvc2VMb2dTdHJlYW0nLCB7XG4gICAgICBsb2dHcm91cDogZmlyZWhvc2VMb2dHcm91cCxcbiAgICB9KTtcblxuICAgIGZpcmVob3NlTG9nR3JvdXAuZ3JhbnRXcml0ZShmaXJlaG9zZVJvbGUpO1xuXG4gICAgLy8gQ3JlYXRlIGEgRmlyZWhvc2UgZGVsaXZlcnkgc3RyZWFtXG4gICAgY29uc3QgZGVsaXZlcnlTdHJlYW0gPSBuZXcgZmlyZWhvc2UuQ2ZuRGVsaXZlcnlTdHJlYW0odGhpcywgJ01ldHJpY3NEZWxpdmVyeVN0cmVhbScsIHtcbiAgICAgIGV4dGVuZGVkUzNEZXN0aW5hdGlvbkNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgYnVja2V0QXJuOiBtZXRyaWNzQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgcm9sZUFybjogZmlyZWhvc2VSb2xlLnJvbGVBcm4sXG4gICAgICAgIGJ1ZmZlcmluZ0hpbnRzOiB7XG4gICAgICAgICAgaW50ZXJ2YWxJblNlY29uZHM6IDYwLFxuICAgICAgICAgIHNpemVJbk1CczogMSxcbiAgICAgICAgfSxcbiAgICAgICAgY2xvdWRXYXRjaExvZ2dpbmdPcHRpb25zOiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBsb2dHcm91cE5hbWU6IGZpcmVob3NlTG9nR3JvdXAubG9nR3JvdXBOYW1lLFxuICAgICAgICAgIGxvZ1N0cmVhbU5hbWU6IGZpcmVob3NlTG9nU3RyZWFtLmxvZ1N0cmVhbU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHByZWZpeDogJ21ldHJpY3MveWVhcj0he3RpbWVzdGFtcDp5eXl5fS9tb250aD0he3RpbWVzdGFtcDpNTX0vZGF5PSF7dGltZXN0YW1wOmRkfS9ob3VyPSF7dGltZXN0YW1wOkhIfS8nLFxuICAgICAgICBlcnJvck91dHB1dFByZWZpeDogJ2Vycm9ycy95ZWFyPSF7dGltZXN0YW1wOnl5eXl9L21vbnRoPSF7dGltZXN0YW1wOk1NfS9kYXk9IXt0aW1lc3RhbXA6ZGR9L2hvdXI9IXt0aW1lc3RhbXA6SEh9LyF7ZmlyZWhvc2U6ZXJyb3Itb3V0cHV0LXR5cGV9JyxcbiAgICAgICAgY29tcHJlc3Npb25Gb3JtYXQ6ICdHWklQJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQXBpRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnTWV0cmljc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogbWV0cmljc0J1Y2tldC5idWNrZXROYW1lLFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnRGVsaXZlcnlTdHJlYW1OYW1lJywge1xuICAgICAgdmFsdWU6IGRlbGl2ZXJ5U3RyZWFtLnJlZixcbiAgICB9KTtcbiAgfVxufSJdfQ==