// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const https = require('https');
const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { createHash } = require('crypto');
const { Sha256 } = require('@aws-crypto/sha256-js');

// OpenSearch configuration
const region = process.env.REGION;
const domain = process.env.ELASTICSEARCH_ENDPOINT;

// Create a signature for the request
async function signRequest(request) {
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: 'es',
    sha256: Sha256
  });

  return signer.sign(request);
}

// Make a request to OpenSearch
async function makeRequest(method, path, body) {
  const endpoint = new URL(`https://${domain}`);
  
  const request = {
    method,
    hostname: endpoint.hostname,
    path,
    headers: {
      'Host': endpoint.hostname,
      'Content-Type': 'application/json'
    },
    protocol: 'https:',
    body: body ? JSON.stringify(body) : undefined
  };

  const signedRequest = await signRequest(request);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        ...signedRequest,
        rejectUnauthorized: true
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: responseBody
          });
        });
      }
    );

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Create index template for daily indices
async function createIndexTemplate() {
  const templateBody = {
    index_patterns: ["softphonestreamstats-*"],
    template: {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0
      },
      mappings: {
        properties: {
          timestamp: { type: "date" },
          agentId: { type: "keyword" },
          contactId: { type: "keyword" },
          softphoneStreamType: { type: "keyword" },
          packetsLost: { type: "integer" },
          packetsCount: { type: "integer" },
          audioLevel: { type: "integer" },
          jitterBufferMillis: { type: "integer" },
          roundTripTimeMillis: { type: "integer" },
          signalingEndpoint: { type: "keyword" },
          iceServers: { type: "text" },
          agentPublicIp: { type: "ip" }
        }
      }
    }
  };

  return makeRequest('PUT', '/_index_template/softphonestreamstats', templateBody);
}

// Create ingest pipeline for daily indices
async function createIngestPipeline() {
  const pipelineBody = {
    description: "daily date-based indices for softphone metrics",
    processors: [
      {
        date_index_name: {
          field: "timestamp",
          date_formats: ["yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"],
          index_name_prefix: "softphonestreamstats-",
          date_rounding: "d"
        }
      }
    ]
  };

  return makeRequest('PUT', '/_ingest/pipeline/stats_dailyindex', pipelineBody);
}

// Create Kibana index pattern
async function createKibanaIndexPattern() {
  // First check if .kibana index exists
  const kibanaIndexResponse = await makeRequest('GET', '/.kibana');
  
  if (kibanaIndexResponse.statusCode === 404) {
    // Create .kibana index if it doesn't exist
    await makeRequest('PUT', '/.kibana');
  }

  // Create index pattern
  const indexPatternId = createHash('md5').update('softphonestreamstats-*').digest('hex');
  const indexPatternBody = {
    type: 'index-pattern',
    'index-pattern': {
      title: 'softphonestreamstats-*',
      timeFieldName: 'timestamp'
    }
  };

  return makeRequest('PUT', `/.kibana/_doc/index-pattern:${indexPatternId}`, indexPatternBody);
}

// Create default dashboard
async function createDefaultDashboard() {
  // This would be a more complex implementation to create visualizations and dashboards
  // For now, we'll just create a simple dashboard object
  const dashboardId = createHash('md5').update('Connect Monitoring Dashboard').digest('hex');
  const dashboardBody = {
    type: 'dashboard',
    dashboard: {
      title: 'Connect Monitoring Dashboard',
      description: 'Dashboard for monitoring Amazon Connect call quality',
      panelsJSON: '[]',
      optionsJSON: '{"darkTheme":false}',
      version: 1,
      timeRestore: false,
      kibanaSavedObjectMeta: {
        searchSourceJSON: '{"filter":[],"query":{"language":"kuery","query":""}}'
      }
    }
  };

  return makeRequest('PUT', `/.kibana/_doc/dashboard:${dashboardId}`, dashboardBody);
}

exports.handler = async function(event, context) {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    if (event.RequestType === 'Delete') {
      return {
        PhysicalResourceId: context.logStreamName,
        Data: {}
      };
    }
    
    // Create index template
    const templateResponse = await createIndexTemplate();
    console.log('Template response:', templateResponse);
    
    // Create ingest pipeline
    const pipelineResponse = await createIngestPipeline();
    console.log('Pipeline response:', pipelineResponse);
    
    // Create Kibana index pattern
    const indexPatternResponse = await createKibanaIndexPattern();
    console.log('Index pattern response:', indexPatternResponse);
    
    // Create default dashboard
    const dashboardResponse = await createDefaultDashboard();
    console.log('Dashboard response:', dashboardResponse);
    
    return {
      PhysicalResourceId: context.logStreamName,
      Data: {
        Message: 'OpenSearch configuration completed successfully'
      }
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};