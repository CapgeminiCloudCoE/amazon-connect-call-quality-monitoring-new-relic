#!/usr/bin/env node
"use strict";
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const deployment_cdk_resources_stack_1 = require("../lib/deployment-cdk-resources-stack");
const app = new aws_cdk_lib_1.App();
new deployment_cdk_resources_stack_1.DeploymentCdkResourcesStack(app, 'DemoTemplate');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95bWVudC1jZGstcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVwbG95bWVudC1jZGstcmVzb3VyY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EscUVBQXFFO0FBQ3JFLGlDQUFpQzs7QUFFakMsdUNBQXFDO0FBQ3JDLDZDQUFrQztBQUNsQywwRkFBb0Y7QUFFcEYsTUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBRyxFQUFFLENBQUM7QUFDdEIsSUFBSSw0REFBMkIsQ0FBQyxHQUFHLEVBQUUsY0FBYyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vLyBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbi8vIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBNSVQtMFxuXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgeyBBcHAgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBEZXBsb3ltZW50Q2RrUmVzb3VyY2VzU3RhY2sgfSBmcm9tICcuLi9saWIvZGVwbG95bWVudC1jZGstcmVzb3VyY2VzLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IEFwcCgpO1xubmV3IERlcGxveW1lbnRDZGtSZXNvdXJjZXNTdGFjayhhcHAsICdEZW1vVGVtcGxhdGUnKTsiXX0=