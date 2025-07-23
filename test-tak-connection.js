#!/usr/bin/env node

import axios from 'axios';
import https from 'https';

console.log('Testing TAK Server connectivity...\n');

// TAK Server configurations to test
const servers = [
  { url: 'https://tak-server:8443', name: 'TAK Server (8443)' },
  { url: 'https://tak-server:8089', name: 'TAK Server (8089)' },
  { url: 'https://tak-server:8080', name: 'TAK Server (8080)' },
  { url: 'http://tak-server:8080', name: 'TAK Server HTTP (8080)' },
];

// Create axios instance with self-signed cert support
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testEndpoint(server) {
  console.log(`Testing ${server.name}...`);
  
  try {
    // Test version endpoint
    const versionUrl = `${server.url}/Marti/api/version`;
    console.log(`  Trying: ${versionUrl}`);
    
    const response = await axios.get(versionUrl, {
      httpsAgent,
      timeout: 5000,
      validateStatus: () => true // Accept any status
    });
    
    console.log(`  Status: ${response.status}`);
    if (response.status === 200) {
      console.log(`  ✅ Success! Version data:`, response.data);
    } else if (response.status === 401) {
      console.log(`  ⚠️  Authentication required (401)`);
    } else if (response.status === 404) {
      console.log(`  ❌ Endpoint not found (404)`);
    } else {
      console.log(`  ⚠️  Unexpected status: ${response.status}`);
    }
    
    // Try CoT endpoint
    const cotUrl = `${server.url}/api/cot/xml/all`;
    console.log(`  Trying CoT endpoint: ${cotUrl}`);
    
    const cotResponse = await axios.get(cotUrl, {
      httpsAgent,
      timeout: 5000,
      validateStatus: () => true
    });
    
    console.log(`  CoT Status: ${cotResponse.status}`);
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`  ❌ Connection refused - port not open`);
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`  ❌ Connection timeout`);
    } else {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('');
}

async function main() {
  for (const server of servers) {
    await testEndpoint(server);
  }
  
  console.log('\nTesting with default ports...');
  
  // Test common TAK ports
  const ports = [8443, 8089, 8080, 8446, 8444];
  for (const port of ports) {
    try {
      console.log(`Checking port ${port}...`);
      const response = await axios.get(`https://tak-server:${port}`, {
        httpsAgent,
        timeout: 2000,
        validateStatus: () => true
      });
      console.log(`  Port ${port} is open (status: ${response.status})`);
    } catch (error) {
      if (error.code !== 'ECONNREFUSED') {
        console.log(`  Port ${port} might be open: ${error.code || error.message}`);
      }
    }
  }
}

main().catch(console.error);