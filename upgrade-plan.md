# Project Upgrade Plan

This document outlines the steps needed to upgrade the Amazon Connect Call Quality Monitoring project to use current, supported versions of all dependencies.

## 1. CDK Migration (v1 to v2)

### Key Changes:
- Migrate from CDK v1.x to CDK v2.x
- Update import statements from individual packages to consolidated AWS CDK v2 package
- Update construct patterns to L2 constructs where available
- Address breaking changes in CDK v2 APIs

## 2. Node.js Runtime Upgrade

### Key Changes:
- Update Node.js from 10.x/14.x to Node.js 20.x
- Update TypeScript to latest LTS version (5.x)
- Update tsconfig.json to use modern settings

## 3. AWS SDK Upgrade

### Key Changes:
- Migrate from AWS SDK v2.x to AWS SDK v3.x
- Update import statements to use modular imports
- Update client instantiation patterns

## 4. Lambda Function Updates

### Key Changes:
- Replace elasticsearch library with opensearch-py
- Update authentication mechanisms for OpenSearch
- Update Python dependencies to current versions

## 5. Frontend Library Updates

### Key Changes:
- Update Amazon Connect Streams API to latest version
- Update connect-rtc.js to latest version
- Update custom implementation to work with new versions

## 6. Development Dependencies

### Key Changes:
- Update Jest and testing libraries
- Update ts-node and other development tools
- Ensure compatibility with new Node.js version

## Implementation Approach

The upgrade will be implemented in the following order:

1. Update root package.json
2. Update monitoring-stack-cdk
   - Update package.json
   - Migrate CDK code
   - Update Lambda functions
3. Update deployment-stack-cdk
   - Update package.json
   - Migrate CDK code
4. Update frontend libraries
5. Test and validate changes