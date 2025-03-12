# Code Versions and Dependencies

This document outlines the versions of frameworks, libraries, and tools used in the Amazon Connect Call Quality Monitoring project.

## Main Project
- Project Version: 1.0.0
- License: MIT-0
- Node.js: 20.x

## CDK Infrastructure

### Monitoring Stack (monitoring-stack-cdk)
- AWS CDK Version: 2.130.0
- TypeScript Version: 5.3.3
- Node.js Types Version: 20.11.24

#### AWS CDK Dependencies:
- aws-cdk-lib: 2.130.0
- constructs: 10.3.0

#### Other Dependencies:
- uuid: 9.0.1
- source-map-support: 0.5.21

#### Development Dependencies:
- jest: 29.7.0
- ts-jest: 29.1.2
- ts-node: 10.9.2

### Deployment Stack (deployment-stack-cdk)
- AWS CDK Version: 2.130.0
- TypeScript Version: 5.3.3
- Node.js Types Version: 20.11.24

#### AWS SDK Dependencies:
- @aws-sdk/client-cloudformation: 3.525.0
- @aws-sdk/client-codebuild: 3.525.0
- @aws-sdk/client-iam: 3.525.0

#### Other Dependencies:
- source-map-support: 0.5.21

#### Development Dependencies:
- jest: 29.7.0
- ts-jest: 29.1.2
- ts-node: 10.9.2

## Frontend Resources
The project includes Amazon Connect frontend integration using:
- amazon-connect-streams: 2.9.1
- amazon-connect-chatjs: 2.9.1

## Lambda Functions
The project includes several Lambda functions with Python runtime environments:
- sendSoftPhoneMetrics
  - opensearch-py: 2.3.0+
  - requests: 2.31.0
  - requests-aws4auth: 1.2.3
  - boto3: 1.28.0+
- sendAPIMetricReport
- sendSoftPhoneReport
- generateSQSmessages

## Runtime Environments
- Node.js: 20.x (for Lambda functions and CDK)
- Python: 3.9+ (for Lambda functions)

## Testing
- Jest Framework for TypeScript testing
- ts-jest for TypeScript processing in Jest

## Custom Resources
Includes custom implementations for:
- Kibana configuration
- SAR confirmation
- Frontend generation