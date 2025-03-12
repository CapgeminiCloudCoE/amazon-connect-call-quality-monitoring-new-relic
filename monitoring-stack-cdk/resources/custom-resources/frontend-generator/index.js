// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client();

exports.handler = async function(event, context) {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    if (event.RequestType === 'Delete') {
      return {
        PhysicalResourceId: context.logStreamName,
        Data: {}
      };
    }
    
    const apiUrl = event.ResourceProperties.ApiUrl;
    const ccpUrl = event.ResourceProperties.CcpUrl;
    const bucketName = event.ResourceProperties.BucketName;
    
    // Generate config.js with the API URL and CCP URL
    const configContent = `
// Generated configuration file
window.connectMonitoringConfig = {
  apiUrl: '${apiUrl}',
  ccpUrl: '${ccpUrl}'
};
`;
    
    // Upload the config file to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: 'config.js',
      Body: configContent,
      ContentType: 'application/javascript'
    }));
    
    console.log('Successfully uploaded config.js to S3');
    
    return {
      PhysicalResourceId: context.logStreamName,
      Data: {
        ConfigUrl: `https://${event.ResourceProperties.DistributionDomainName}/config.js`
      }
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};