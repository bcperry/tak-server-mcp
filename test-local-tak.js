#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Testing TAK Server MCP with local TAK server at 192.168.1.124:8087\n');

// Start the MCP server with local configuration
const server = spawn('node', [
  path.join(__dirname, 'dist/index.js'),
  '--config', path.join(__dirname, 'config/local-tak-server.json')
], {
  env: {
    ...process.env,
    TAK_SERVER_URL: 'https://192.168.1.124:8087',
    NODE_TLS_REJECT_UNAUTHORIZED: '0', // Allow self-signed certificates
    MCP_TRANSPORT: 'stdio',
    LOG_LEVEL: 'debug'
  }
});

let messageId = 1;

// Handle server output
server.stdout.on('data', (data) => {
  try {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const message = JSON.parse(line);
        console.log('Response:', JSON.stringify(message, null, 2));
      } catch (e) {
        // Not JSON, log as is
        if (line.trim()) {
          console.log('Server:', line);
        }
      }
    });
  } catch (e) {
    console.log('Server output:', data.toString());
  }
});

server.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

// Send a request to the server
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  console.log('\nSending request:', JSON.stringify(request, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');
}

// Wait for server to start
setTimeout(async () => {
  console.log('\n📡 Initializing connection...\n');
  
  // Initialize the MCP connection
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {}
  });

  // Wait a bit then test some tools
  setTimeout(() => {
    console.log('\n🧪 Testing TAK Server connection...\n');
    
    // Test 1: List available tools
    console.log('\n1️⃣ Listing available tools:');
    sendRequest('tools/list');

    setTimeout(() => {
      // Test 2: Get entities (this should work without authentication)
      console.log('\n2️⃣ Getting TAK entities:');
      sendRequest('tools/call', {
        name: 'tak_get_entities',
        arguments: {}
      });

      setTimeout(() => {
        // Test 3: Get recent CoT events
        console.log('\n3️⃣ Getting recent CoT events:');
        sendRequest('tools/call', {
          name: 'tak_get_cot_events',
          arguments: {
            limit: 5
          }
        });

        setTimeout(() => {
          // Test 4: Calculate a test distance
          console.log('\n4️⃣ Testing distance calculation:');
          sendRequest('tools/call', {
            name: 'tak_calculate_distance',
            arguments: {
              from: { coordinates: [37.7749, -122.4194] },
              to: { coordinates: [37.7849, -122.4094] },
              units: 'meters'
            }
          });

          // Give some time for responses then exit
          setTimeout(() => {
            console.log('\n✅ Tests completed. Shutting down...');
            server.kill();
            process.exit(0);
          }, 5000);
        }, 2000);
      }, 2000);
    }, 2000);
  }, 2000);
}, 1000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  process.exit(0);
});