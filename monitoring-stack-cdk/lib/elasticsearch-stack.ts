// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { 
  Stack, 
  StackProps, 
  Duration, 
  CfnOutput, 
  RemovalPolicy, 
  CustomResource 
} from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as cr from 'aws-cdk-lib/custom-resources';

interface ElasticSearchStackProps extends StackProps {
  ccpUrl: string;
}

export class ElasticSearchStack extends Construct {
  public readonly elasticsearchArn: string;
  private readonly elasticsearchDomain: opensearch.Domain;
  private readonly userPool: cognito.UserPool;
  private readonly identityPool: cognito.CfnIdentityPool;
  private readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: ElasticSearchStackProps) {
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
      removalPolicy: RemovalPolicy.DESTROY,
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
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
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
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Grant permissions to the authenticated role
    this.elasticsearchDomain.grantReadWrite(authenticatedRole);

    // Create a Lambda function to configure Kibana
    const kibanaConfigFunction = new lambda.Function(this, 'KibanaConfigFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('./resources/custom-resources/kibana-config', {
        bundling: {
          image: lambda.Runtime.NODEJS_18_X.bundlingImage,
          command: [
            'bash', '-c', [
              'npm install',
              'cp -r /asset-input/* /asset-output/'
            ].join(' && ')
          ]
        }
      }),
      timeout: Duration.minutes(5),
      environment: {
        ELASTICSEARCH_ENDPOINT: this.elasticsearchDomain.domainEndpoint,
        REGION: Stack.of(this).region,
      },
    });

    // Grant permissions to the Lambda function
    this.elasticsearchDomain.grantReadWrite(kibanaConfigFunction);

    // Create a custom resource to configure Kibana
    const kibanaConfigProvider = new cr.Provider(this, 'KibanaConfigProvider', {
      onEventHandler: kibanaConfigFunction,
    });

    new CustomResource(this, 'KibanaConfigResource', {
      serviceToken: kibanaConfigProvider.serviceToken,
      properties: {
        DomainEndpoint: this.elasticsearchDomain.domainEndpoint,
      },
    });

    // Set the elasticsearch ARN
    this.elasticsearchArn = this.elasticsearchDomain.domainArn;

    // Outputs
    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });

    new CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
    });

    new CfnOutput(this, 'ElasticsearchDomainEndpoint', {
      value: this.elasticsearchDomain.domainEndpoint,
    });

    new CfnOutput(this, 'KibanaURL', {
      value: `https://${this.elasticsearchDomain.domainEndpoint}/_dashboards/`,
    });
  }

  public getUserCreateUrl(): string {
    return `https://${this.userPool.userPoolId}.auth.${Stack.of(this).region}.amazoncognito.com/login?client_id=${this.userPoolClient.userPoolClientId}&response_type=token&redirect_uri=https://${this.elasticsearchDomain.domainEndpoint}/_dashboards/`;
  }

  public getKibanaUrl(): string {
    return `https://${this.elasticsearchDomain.domainEndpoint}/_dashboards/`;
  }
}