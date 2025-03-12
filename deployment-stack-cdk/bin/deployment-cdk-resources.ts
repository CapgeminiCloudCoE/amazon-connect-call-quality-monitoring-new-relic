#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { DeploymentCdkResourcesStack } from '../lib/deployment-cdk-resources-stack';

const app = new App();
new DeploymentCdkResourcesStack(app, 'DemoTemplate');