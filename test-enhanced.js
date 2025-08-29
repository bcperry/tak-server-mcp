#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Testing TAK Server MCP with enhanced response logging\n');

// Start the MCP server with local configuration
const server = spawn('node', [
  path.join(__dirname, 'dist/index.js'),
  '--config', path.join(__dirname, 'config/local-tak-server.json')
], {
  env: {
    ...process.env,
    TAK_SERVER_URL: 'https://192.168.1.124:8087',
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    MCP_TRANSPORT: 'stdio',
    LOG_LEVEL: 'debug'
  }
});

let messageId = 1;
let responses = [];

// Enhanced response handler
server.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('📤 Raw server output:', text);
  
  // Try to parse each line as JSON
  const lines = text.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const message = JSON.parse(line);
      console.log('📨 Parsed JSON Response:', JSON.stringify(message, null, 2));
      responses.push(message);
    } catch (e) {
      // Not JSON, could be log output
      if (line.trim() && !line.includes('INFO') && !line.includes('ERROR')) {
        console.log('📝 Server message:', line);
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('❌ Server error:', data.toString());
});

server.on('exit', (code) => {
  console.log(`\n🔚 Server exited with code ${code}`);
  console.log(`📊 Total responses received: ${responses.length}`);
  
  if (responses.length > 0) {
    console.log('\n📋 All responses summary:');
    responses.forEach((resp, i) => {
      console.log(`${i + 1}. ${resp.method || 'Response'} (ID: ${resp.id})`);
    });
  }
});

// Send a request to the server
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  console.log('\n📤 Sending request:', JSON.stringify(request, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Return a promise that resolves when we get a response
  return new Promise((resolve) => {
    const checkForResponse = () => {
      const response = responses.find(r => r.id === request.id);
      if (response) {
        resolve(response);
      } else {
        setTimeout(checkForResponse, 100);
      }
    };
    setTimeout(checkForResponse, 100);
  });
}

// Wait for server to start
setTimeout(async () => {
  try {
    console.log('\n📡 Initializing connection...');
    
    // Initialize the MCP connection
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {}
    });
    console.log('✅ Initialize response received');

    // Test 1: List available tools
    console.log('\n1️⃣ Listing available tools:');
    const toolsResponse = await sendRequest('tools/list');
    console.log('✅ Tools list response received');
    
    if (toolsResponse.result && toolsResponse.result.tools) {
      console.log(`📋 Found ${toolsResponse.result.tools.length} tools:`);
      toolsResponse.result.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
    }

    // Test 2: Get entities
    console.log('\n2️⃣ Getting TAK entities:');
    const entitiesResponse = await sendRequest('tools/call', {
      name: 'tak_get_entities',
      arguments: {}
    });
    console.log('✅ Entities response received');

    if (entitiesResponse.result) {
      console.log('📍 Entities result:', JSON.stringify(entitiesResponse.result, null, 2));
    }

    // Test 3: Get recent CoT events
    console.log('\n3️⃣ Getting recent CoT events:');
    const eventsResponse = await sendRequest('tools/call', {
      name: 'tak_get_cot_events',
      arguments: { limit: 5 }
    });
    console.log('✅ CoT events response received');

    if (eventsResponse.result) {
      console.log('📡 CoT events result:', JSON.stringify(eventsResponse.result, null, 2));
    }

    // Test 4: Calculate distance
    console.log('\n4️⃣ Testing distance calculation:');
    const distanceResponse = await sendRequest('tools/call', {
      name: 'tak_calculate_distance',
      arguments: {
        from: { coordinates: [37.7749, -122.4194] },
        to: { coordinates: [37.7849, -122.4094] },
        units: 'meters'
      }
    });
    console.log('✅ Distance calculation response received');

    if (distanceResponse.result) {
      console.log('📏 Distance result:', JSON.stringify(distanceResponse.result, null, 2));
    }

    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Shutdown
    setTimeout(() => {
      console.log('\n🔚 Shutting down server...');
      server.kill();
    }, 1000);
  }
}, 2000);
