// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { CodeBuildClient, StartBuildCommand } = require('@aws-sdk/client-codebuild');

exports.handler = async function(event, context) {
  console.log(JSON.stringify(event, null, 2));
  
  const codebuild = new CodeBuildClient();
  
  try {
    const params = {
      projectName: process.env.ProjectName
    };
    
    const command = new StartBuildCommand(params);
    const data = await codebuild.send(command);
    
    console.log("Build started successfully");
    console.log(data);
    
    return {
      PhysicalResourceId: data.build.id,
      Data: {
        CognitoUrl: "Pending",
        KibanaUrl: "Pending",
        CloudfrontUrl: "Pending"
      }
    };
  } catch (error) {
    console.error("Error starting build:", error);
    throw error;
  }
};