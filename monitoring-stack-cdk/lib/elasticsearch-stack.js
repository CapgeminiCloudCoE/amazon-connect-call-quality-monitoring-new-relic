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
exports.ElasticSearchStack = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearchservice"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
class ElasticSearchStack extends constructs_1.Construct {
    elasticsearchArn;
    elasticsearchDomain;
    userPool;
    identityPool;
    userPoolClient;
    constructor(scope, id, props) {
        super(scope, id);
        // Create a Cognito User Pool for authentication
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
            },
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // Create a User Pool Client
        this.userPoolClient = this.userPool.addClient('UserPoolClient', {
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
        });
        // Create an Identity Pool
        this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [
                {
                    clientId: this.userPoolClient.userPoolClientId,
                    providerName: this.userPool.userPoolProviderName,
                },
            ],
        });
        // Create authenticated and unauthenticated roles
        const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
                StringEquals: {
                    'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
                },
                'ForAnyValue:StringLike': {
                    'cognito-identity.amazonaws.com:amr': 'authenticated',
                },
            }, 'sts:AssumeRoleWithWebIdentity'),
        });
        // Attach role to identity pool
        new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
            identityPoolId: this.identityPool.ref,
            roles: {
                authenticated: authenticatedRole.roleArn,
            },
        });
        // Create OpenSearch domain
        this.elasticsearchDomain = new opensearch.Domain(this, 'ElasticsearchDomain', {
            version: opensearch.EngineVersion.OPENSEARCH_1_3,
            capacity: {
                dataNodeInstanceType: 't3.small.search',
                dataNodes: 1,
            },
            ebs: {
                volumeSize: 10,
            },
            zoneAwareness: {
                enabled: false,
            },
            logging: {
                slowSearchLogEnabled: true,
                appLogEnabled: true,
                slowIndexLogEnabled: true,
            },
            encryptionAtRest: {
                enabled: true,
            },
            nodeToNodeEncryption: true,
            enforceHttps: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // Grant permissions to the authenticated role
        this.elasticsearchDomain.grantReadWrite(authenticatedRole);
        // Create a Lambda function to configure Kibana
        const kibanaConfigFunction = new lambda.Function(this, 'KibanaConfigFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('./resources/custom-resources/kibana-config'),
            timeout: aws_cdk_lib_1.Duration.minutes(5),
            environment: {
                ELASTICSEARCH_ENDPOINT: this.elasticsearchDomain.domainEndpoint,
                REGION: aws_cdk_lib_1.Stack.of(this).region,
            },
        });
        // Grant permissions to the Lambda function
        this.elasticsearchDomain.grantReadWrite(kibanaConfigFunction);
        // Create a custom resource to configure Kibana
        const kibanaConfigProvider = new cr.Provider(this, 'KibanaConfigProvider', {
            onEventHandler: kibanaConfigFunction,
        });
        new aws_cdk_lib_1.CustomResource(this, 'KibanaConfigResource', {
            serviceToken: kibanaConfigProvider.serviceToken,
            properties: {
                DomainEndpoint: this.elasticsearchDomain.domainEndpoint,
            },
        });
        // Set the elasticsearch ARN
        this.elasticsearchArn = this.elasticsearchDomain.domainArn;
        // Outputs
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'IdentityPoolId', {
            value: this.identityPool.ref,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'ElasticsearchDomainEndpoint', {
            value: this.elasticsearchDomain.domainEndpoint,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'KibanaURL', {
            value: `https://${this.elasticsearchDomain.domainEndpoint}/_dashboards/`,
        });
    }
    getUserCreateUrl() {
        return `https://${this.userPool.userPoolId}.auth.${aws_cdk_lib_1.Stack.of(this).region}.amazoncognito.com/login?client_id=${this.userPoolClient.userPoolClientId}&response_type=token&redirect_uri=https://${this.elasticsearchDomain.domainEndpoint}/_dashboards/`;
    }
    getKibanaUrl() {
        return `https://${this.elasticsearchDomain.domainEndpoint}/_dashboards/`;
    }
}
exports.ElasticSearchStack = ElasticSearchStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxhc3RpY3NlYXJjaC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVsYXN0aWNzZWFyY2gtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFFQUFxRTtBQUNyRSxpQ0FBaUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVqQywyQ0FBdUM7QUFDdkMsNkNBT3FCO0FBQ3JCLGlFQUFtRDtBQUNuRCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELDhFQUFnRTtBQUNoRSxpRUFBbUQ7QUFNbkQsTUFBYSxrQkFBbUIsU0FBUSxzQkFBUztJQUMvQixnQkFBZ0IsQ0FBUztJQUN4QixtQkFBbUIsQ0FBb0I7SUFDdkMsUUFBUSxDQUFtQjtJQUMzQixZQUFZLENBQTBCO0lBQ3RDLGNBQWMsQ0FBeUI7SUFFeEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE4QjtRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLGdEQUFnRDtRQUNoRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ3JELGlCQUFpQixFQUFFLElBQUk7WUFDdkIsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUMzQixrQkFBa0IsRUFBRTtnQkFDbEIsS0FBSyxFQUFFO29CQUNMLFFBQVEsRUFBRSxJQUFJO29CQUNkLE9BQU8sRUFBRSxJQUFJO2lCQUNkO2FBQ0Y7WUFDRCxhQUFhLEVBQUUsMkJBQWEsQ0FBQyxPQUFPO1NBQ3JDLENBQUMsQ0FBQztRQUVILDRCQUE0QjtRQUM1QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLGdCQUFnQixFQUFFO1lBQzlELFNBQVMsRUFBRTtnQkFDVCxZQUFZLEVBQUUsSUFBSTtnQkFDbEIsT0FBTyxFQUFFLElBQUk7YUFDZDtTQUNG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Q0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxzQ0FBc0MsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsNkNBQTZDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLGVBQWUsQ0FBQztJQUN4UCxDQUFDO0lBRU0sWUFBWTtRQUNqQixPQUFPLFdBQVcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsZUFBZSxDQUFDO0lBQzNFLENBQUM7Q0FDRjtBQTFKRCxnREEwSkMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbi8vIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBNSVQtMFxuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFxuICBTdGFjaywgXG4gIFN0YWNrUHJvcHMsIFxuICBEdXJhdGlvbiwgXG4gIENmbk91dHB1dCwgXG4gIFJlbW92YWxQb2xpY3ksIFxuICBDdXN0b21SZXNvdXJjZSBcbn0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBvcGVuc2VhcmNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1vcGVuc2VhcmNoc2VydmljZSc7XG5pbXBvcnQgKiBhcyBjciBmcm9tICdhd3MtY2RrLWxpYi9jdXN0b20tcmVzb3VyY2VzJztcblxuaW50ZXJmYWNlIEVsYXN0aWNTZWFyY2hTdGFja1Byb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XG4gIGNjcFVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRWxhc3RpY1NlYXJjaFN0YWNrIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGVsYXN0aWNzZWFyY2hBcm46IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBlbGFzdGljc2VhcmNoRG9tYWluOiBvcGVuc2VhcmNoLkRvbWFpbjtcbiAgcHJpdmF0ZSByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHJpdmF0ZSByZWFkb25seSBpZGVudGl0eVBvb2w6IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sO1xuICBwcml2YXRlIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFbGFzdGljU2VhcmNoU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgYSBDb2duaXRvIFVzZXIgUG9vbCBmb3IgYXV0aGVudGljYXRpb25cbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBhdXRvVmVyaWZ5OiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhIFVzZXIgUG9vbCBDbGllbnRcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gdGhpcy51c2VyUG9vbC5hZGRDbGllbnQoJ1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYW4gSWRlbnRpdHkgUG9vbFxuICAgIHRoaXMuaWRlbnRpdHlQb29sID0gbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sKHRoaXMsICdJZGVudGl0eVBvb2wnLCB7XG4gICAgICBhbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXM6IGZhbHNlLFxuICAgICAgY29nbml0b0lkZW50aXR5UHJvdmlkZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBjbGllbnRJZDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICAgIHByb3ZpZGVyTmFtZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbFByb3ZpZGVyTmFtZSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYXV0aGVudGljYXRlZCBhbmQgdW5hdXRoZW50aWNhdGVkIHJvbGVzXG4gICAgY29uc3QgYXV0aGVudGljYXRlZFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0F1dGhlbnRpY2F0ZWRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbScsXG4gICAgICAgIHtcbiAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgICdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkJzogdGhpcy5pZGVudGl0eVBvb2wucmVmLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ0ZvckFueVZhbHVlOlN0cmluZ0xpa2UnOiB7XG4gICAgICAgICAgICAnY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmFtcic6ICdhdXRoZW50aWNhdGVkJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnc3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHknXG4gICAgICApLFxuICAgIH0pO1xuXG4gICAgLy8gQXR0YWNoIHJvbGUgdG8gaWRlbnRpdHkgcG9vbFxuICAgIG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50KHRoaXMsICdJZGVudGl0eVBvb2xSb2xlQXR0YWNobWVudCcsIHtcbiAgICAgIGlkZW50aXR5UG9vbElkOiB0aGlzLmlkZW50aXR5UG9vbC5yZWYsXG4gICAgICByb2xlczoge1xuICAgICAgICBhdXRoZW50aWNhdGVkOiBhdXRoZW50aWNhdGVkUm9sZS5yb2xlQXJuLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBPcGVuU2VhcmNoIGRvbWFpblxuICAgIHRoaXMuZWxhc3RpY3NlYXJjaERvbWFpbiA9IG5ldyBvcGVuc2VhcmNoLkRvbWFpbih0aGlzLCAnRWxhc3RpY3NlYXJjaERvbWFpbicsIHtcbiAgICAgIHZlcnNpb246IG9wZW5zZWFyY2guRW5naW5lVmVyc2lvbi5PUEVOU0VBUkNIXzFfMyxcbiAgICAgIGNhcGFjaXR5OiB7XG4gICAgICAgIGRhdGFOb2RlSW5zdGFuY2VUeXBlOiAndDMuc21hbGwuc2VhcmNoJyxcbiAgICAgICAgZGF0YU5vZGVzOiAxLFxuICAgICAgfSxcbiAgICAgIGViczoge1xuICAgICAgICB2b2x1bWVTaXplOiAxMCxcbiAgICAgIH0sXG4gICAgICB6b25lQXdhcmVuZXNzOiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGxvZ2dpbmc6IHtcbiAgICAgICAgc2xvd1NlYXJjaExvZ0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIGFwcExvZ0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIHNsb3dJbmRleExvZ0VuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgZW5jcnlwdGlvbkF0UmVzdDoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG5vZGVUb05vZGVFbmNyeXB0aW9uOiB0cnVlLFxuICAgICAgZW5mb3JjZUh0dHBzOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gdGhlIGF1dGhlbnRpY2F0ZWQgcm9sZVxuICAgIHRoaXMuZWxhc3RpY3NlYXJjaERvbWFpbi5ncmFudFJlYWRXcml0ZShhdXRoZW50aWNhdGVkUm9sZSk7XG5cbiAgICAvLyBDcmVhdGUgYSBMYW1iZGEgZnVuY3Rpb24gdG8gY29uZmlndXJlIEtpYmFuYVxuICAgIGNvbnN0IGtpYmFuYUNvbmZpZ0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnS2liYW5hQ29uZmlnRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi9yZXNvdXJjZXMvY3VzdG9tLXJlc291cmNlcy9raWJhbmEtY29uZmlnJyksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRUxBU1RJQ1NFQVJDSF9FTkRQT0lOVDogdGhpcy5lbGFzdGljc2VhcmNoRG9tYWluLmRvbWFpbkVuZHBvaW50LFxuICAgICAgICBSRUdJT046IFN0YWNrLm9mKHRoaXMpLnJlZ2lvbixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byB0aGUgTGFtYmRhIGZ1bmN0aW9uXG4gICAgdGhpcy5lbGFzdGljc2VhcmNoRG9tYWluLmdyYW50UmVhZFdyaXRlKGtpYmFuYUNvbmZpZ0Z1bmN0aW9uKTtcblxuICAgIC8vIENyZWF0ZSBhIGN1c3RvbSByZXNvdXJjZSB0byBjb25maWd1cmUgS2liYW5hXG4gICAgY29uc3Qga2liYW5hQ29uZmlnUHJvdmlkZXIgPSBuZXcgY3IuUHJvdmlkZXIodGhpcywgJ0tpYmFuYUNvbmZpZ1Byb3ZpZGVyJywge1xuICAgICAgb25FdmVudEhhbmRsZXI6IGtpYmFuYUNvbmZpZ0Z1bmN0aW9uLFxuICAgIH0pO1xuXG4gICAgbmV3IEN1c3RvbVJlc291cmNlKHRoaXMsICdLaWJhbmFDb25maWdSZXNvdXJjZScsIHtcbiAgICAgIHNlcnZpY2VUb2tlbjoga2liYW5hQ29uZmlnUHJvdmlkZXIuc2VydmljZVRva2VuLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBEb21haW5FbmRwb2ludDogdGhpcy5lbGFzdGljc2VhcmNoRG9tYWluLmRvbWFpbkVuZHBvaW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFNldCB0aGUgZWxhc3RpY3NlYXJjaCBBUk5cbiAgICB0aGlzLmVsYXN0aWNzZWFyY2hBcm4gPSB0aGlzLmVsYXN0aWNzZWFyY2hEb21haW4uZG9tYWluQXJuO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgfSk7XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdJZGVudGl0eVBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmlkZW50aXR5UG9vbC5yZWYsXG4gICAgfSk7XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdFbGFzdGljc2VhcmNoRG9tYWluRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5lbGFzdGljc2VhcmNoRG9tYWluLmRvbWFpbkVuZHBvaW50LFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnS2liYW5hVVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5lbGFzdGljc2VhcmNoRG9tYWluLmRvbWFpbkVuZHBvaW50fS9fZGFzaGJvYXJkcy9gLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGdldFVzZXJDcmVhdGVVcmwoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYGh0dHBzOi8vJHt0aGlzLnVzZXJQb29sLnVzZXJQb29sSWR9LmF1dGguJHtTdGFjay5vZih0aGlzKS5yZWdpb259LmFtYXpvbmNvZ25pdG8uY29tL2xvZ2luP2NsaWVudF9pZD0ke3RoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZH0mcmVzcG9uc2VfdHlwZT10b2tlbiZyZWRpcmVjdF91cmk9aHR0cHM6Ly8ke3RoaXMuZWxhc3RpY3NlYXJjaERvbWFpbi5kb21haW5FbmRwb2ludH0vX2Rhc2hib2FyZHMvYDtcbiAgfVxuXG4gIHB1YmxpYyBnZXRLaWJhbmFVcmwoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYGh0dHBzOi8vJHt0aGlzLmVsYXN0aWNzZWFyY2hEb21haW4uZG9tYWluRW5kcG9pbnR9L19kYXNoYm9hcmRzL2A7XG4gIH1cbn0iXX0=