#!/usr/bin/env node

/**
 * Simple connection test for TAK server
 */

import https from 'https';
import http from 'http';

const TAK_PORTS = [8080, 8087, 8443, 8446, 9000];
const HOST = 'localhost';

console.log('🔍 Testing TAK server connectivity...\n');

async function testConnection(host, port, useHttps = true) {
  return new Promise((resolve) => {
    const protocol = useHttps ? https : http;
    const options = {
      hostname: host,
      port: port,
      path: '/',
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false // Allow self-signed certificates
    };

    const req = protocol.request(options, (res) => {
      console.log(`✅ ${useHttps ? 'HTTPS' : 'HTTP'}://${host}:${port} - Status: ${res.statusCode}`);
      resolve({ success: true, port, protocol: useHttps ? 'https' : 'http', status: res.statusCode });
    });

    req.on('error', (err) => {
      console.log(`❌ ${useHttps ? 'HTTPS' : 'HTTP'}://${host}:${port} - ${err.message}`);
      resolve({ success: false, port, protocol: useHttps ? 'https' : 'http', error: err.message });
    });

    req.on('timeout', () => {
      console.log(`⏰ ${useHttps ? 'HTTPS' : 'HTTP'}://${host}:${port} - Timeout`);
      req.destroy();
      resolve({ success: false, port, protocol: useHttps ? 'https' : 'http', error: 'timeout' });
    });

    req.end();
  });
}

async function testAllPorts() {
  console.log(`Testing common TAK server ports on ${HOST}...\n`);
  
  for (const port of TAK_PORTS) {
    await testConnection(HOST, port, true);
    await testConnection(HOST, port, false);
    console.log('');
  }

  console.log('\n🔍 Also testing TAK API endpoints...\n');
  
  // Test common TAK API endpoints
  const apiEndpoints = [
    '/Marti/api/version',
    '/Marti/api/contacts/all',
    '/Marti/api/cot',
    '/api/version',
    '/api/contacts/all',
    '/api/cot'
  ];

  for (const port of [8080, 8087, 8443]) {
    for (const endpoint of apiEndpoints) {
      await testEndpoint(HOST, port, endpoint);
    }
  }
}

async function testEndpoint(host, port, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      timeout: 3000,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'TAK-MCP-Test/1.0'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`📡 https://${host}:${port}${path} - Status: ${res.statusCode}`);
      resolve({ success: true, status: res.statusCode });
    });

    req.on('error', (err) => {
      // Only log if it's not a connection refused error (to reduce noise)
      if (!err.message.includes('ECONNREFUSED')) {
        console.log(`❌ https://${host}:${port}${path} - ${err.message}`);
      }
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
}

testAllPorts().catch(console.error);
