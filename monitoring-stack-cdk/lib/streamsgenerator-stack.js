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
exports.StreamsGeneratorStack = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
class StreamsGeneratorStack extends constructs_1.Construct {
    constructor(scope, id, props) {
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
        new aws_cdk_lib_1.CustomResource(this, 'FrontendGeneratorResource', {
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
exports.StreamsGeneratorStack = StreamsGeneratorStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyZWFtc2dlbmVyYXRvci1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0cmVhbXNnZW5lcmF0b3Itc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFFQUFxRTtBQUNyRSxpQ0FBaUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVqQywyQ0FBdUM7QUFDdkMsNkNBQThEO0FBSzlELHdFQUEwRDtBQUMxRCwrREFBaUQ7QUFFakQsaUVBQW1EO0FBVW5ELE1BQWEscUJBQXNCLFNBQVEsc0JBQVM7SUFDbEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFpQztRQUN6RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLDhDQUE4QztRQUM5QyxJQUFJLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDekQsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztZQUM3QixpQkFBaUIsRUFBRSxLQUFLLENBQUMsYUFBYTtTQUN2QyxDQUFDLENBQUM7UUFFSCxrRUFBa0U7UUFDbEUsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQ3ZGLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGlEQUFpRCxDQUFDO1lBQzlFLE9BQU8sRUFBRSxzQkFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDNUIsV0FBVyxFQUFFO2dCQUNYLE9BQU8sRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUc7Z0JBQ3RCLE9BQU8sRUFBRSxLQUFLLENBQUMsTUFBTTtnQkFDckIsV0FBVyxFQUFFLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVTthQUM1QztTQUNGLENBQUMsQ0FBQztRQUVILGtFQUFrRTtRQUNsRSxLQUFLLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBRTlELG9DQUFvQztRQUNwQyxNQUFNLHlCQUF5QixHQUFHLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDbkYsY0FBYyxFQUFFLHlCQUF5QjtTQUMxQyxDQUFDLENBQUM7UUFFSCw4REFBOEQ7UUFDOUQsSUFBSSw0QkFBYyxDQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRTtZQUNwRCxZQUFZLEVBQUUseUJBQXlCLENBQUMsWUFBWTtZQUNwRCxVQUFVLEVBQUU7Z0JBQ1YsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRztnQkFDckIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO2dCQUNwQixVQUFVLEVBQUUsS0FBSyxDQUFDLGFBQWEsQ0FBQyxVQUFVO2dCQUMxQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsbUJBQW1CLENBQUMsc0JBQXNCO2dCQUN4RSw2RUFBNkU7Z0JBQzdFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO2FBQ2pDO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBNUNELHNEQTRDQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuLy8gU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IE1JVC0wXG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU3RhY2ssIER1cmF0aW9uLCBDdXN0b21SZXNvdXJjZSB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGNyIGZyb20gJ2F3cy1jZGstbGliL2N1c3RvbS1yZXNvdXJjZXMnO1xuXG5pbnRlcmZhY2UgU3RyZWFtc0dlbmVyYXRvclN0YWNrUHJvcHMge1xuICBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgY2NwVXJsOiBzdHJpbmc7XG4gIHN0cmVhbXNBc3NldDogczNkZXBsb3kuSVNvdXJjZTtcbiAgc3RyZWFtc0J1Y2tldDogczMuQnVja2V0O1xuICBzdHJlYW1zRGlzdHJpYnV0aW9uOiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcbn1cblxuZXhwb3J0IGNsYXNzIFN0cmVhbXNHZW5lcmF0b3JTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdHJlYW1zR2VuZXJhdG9yU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBEZXBsb3kgdGhlIGZyb250ZW5kIGFzc2V0cyB0byB0aGUgUzMgYnVja2V0XG4gICAgbmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQodGhpcywgJ0RlcGxveVN0cmVhbXNBc3NldHMnLCB7XG4gICAgICBzb3VyY2VzOiBbcHJvcHMuc3RyZWFtc0Fzc2V0XSxcbiAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiBwcm9wcy5zdHJlYW1zQnVja2V0LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGEgTGFtYmRhIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSBmcm9udGVuZCBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgZnJvbnRlbmRHZW5lcmF0b3JGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Zyb250ZW5kR2VuZXJhdG9yRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi9yZXNvdXJjZXMvY3VzdG9tLXJlc291cmNlcy9mcm9udGVuZC1nZW5lcmF0b3InKSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBBUElfVVJMOiBwcm9wcy5hcGkudXJsLFxuICAgICAgICBDQ1BfVVJMOiBwcm9wcy5jY3BVcmwsXG4gICAgICAgIEJVQ0tFVF9OQU1FOiBwcm9wcy5zdHJlYW1zQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgdGhlIExhbWJkYSBmdW5jdGlvbiBwZXJtaXNzaW9ucyB0byB3cml0ZSB0byB0aGUgUzMgYnVja2V0XG4gICAgcHJvcHMuc3RyZWFtc0J1Y2tldC5ncmFudFJlYWRXcml0ZShmcm9udGVuZEdlbmVyYXRvckZ1bmN0aW9uKTtcblxuICAgIC8vIENyZWF0ZSBhIGN1c3RvbSByZXNvdXJjZSBwcm92aWRlclxuICAgIGNvbnN0IGZyb250ZW5kR2VuZXJhdG9yUHJvdmlkZXIgPSBuZXcgY3IuUHJvdmlkZXIodGhpcywgJ0Zyb250ZW5kR2VuZXJhdG9yUHJvdmlkZXInLCB7XG4gICAgICBvbkV2ZW50SGFuZGxlcjogZnJvbnRlbmRHZW5lcmF0b3JGdW5jdGlvbixcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhIGN1c3RvbSByZXNvdXJjZSB0byB0cmlnZ2VyIHRoZSBmcm9udGVuZCBnZW5lcmF0aW9uXG4gICAgbmV3IEN1c3RvbVJlc291cmNlKHRoaXMsICdGcm9udGVuZEdlbmVyYXRvclJlc291cmNlJywge1xuICAgICAgc2VydmljZVRva2VuOiBmcm9udGVuZEdlbmVyYXRvclByb3ZpZGVyLnNlcnZpY2VUb2tlbixcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgQXBpVXJsOiBwcm9wcy5hcGkudXJsLFxuICAgICAgICBDY3BVcmw6IHByb3BzLmNjcFVybCxcbiAgICAgICAgQnVja2V0TmFtZTogcHJvcHMuc3RyZWFtc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBEaXN0cmlidXRpb25Eb21haW5OYW1lOiBwcm9wcy5zdHJlYW1zRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgIC8vIEFkZCBhIHJhbmRvbSB2YWx1ZSB0byBmb3JjZSB0aGUgY3VzdG9tIHJlc291cmNlIHRvIHJ1biBvbiBldmVyeSBkZXBsb3ltZW50XG4gICAgICAgIFJhbmRvbTogTWF0aC5yYW5kb20oKS50b1N0cmluZygpLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxufSJdfQ==