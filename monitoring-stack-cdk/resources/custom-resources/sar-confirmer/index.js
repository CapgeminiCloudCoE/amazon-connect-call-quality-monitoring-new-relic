// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

exports.handler = async function(event, context) {
  console.log(JSON.stringify(event, null, 2));
  
  return {
    PhysicalResourceId: context.logStreamName,
    Data: {
      CognitoUrl: process.env.COGNITO_URL || "",
      KibanaUrl: process.env.KIBANA_URL || "",
      CloudfrontUrl: process.env.CLOUDFRONT_URL ? `https://${process.env.CLOUDFRONT_URL}` : "",
      CFN_RESPONSE_PAYLOAD: process.env.CFN_RESPONSE_PAYLOAD || ""
    }
  };
};