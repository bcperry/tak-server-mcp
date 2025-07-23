#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

console.log('🚀 Testing TAK Server MCP with FreeTAKServer\n');

// First check if FreeTAKServer is running
async function checkFreeTAKServer() {
  console.log('🔍 Checking FreeTAKServer status...\n');
  
  try {
    // Check REST API
    const apiResponse = await axios.get('http://localhost:19023/SystemStatus/getStatus', {
      timeout: 5000
    });
    console.log('✅ FreeTAKServer REST API is running');
    console.log('   Status:', apiResponse.data);
    
    // Check if CoT port is open
    const net = require('net');
    const cotClient = new net.Socket();
    
    return new Promise((resolve) => {
      cotClient.connect(8087, 'localhost', () => {
        console.log('✅ FreeTAKServer CoT port (8087) is open\n');
        cotClient.destroy();
        resolve(true);
      });
      
      cotClient.on('error', () => {
        console.log('❌ FreeTAKServer CoT port (8087) is not accessible');
        console.log('   Make sure FreeTAKServer is running with:');
        console.log('   cd freetakserver-setup && docker-compose up -d\n');
        cotClient.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    console.log('❌ FreeTAKServer is not running or not accessible');
    console.log('   Error:', error.message);
    console.log('\n   To start FreeTAKServer:');
    console.log('   cd freetakserver-setup');
    console.log('   docker-compose up -d\n');
    return false;
  }
}

async function runMCPTests() {
  console.log('📡 Starting TAK Server MCP...\n');
  
  const server = spawn('node', [
    path.join(__dirname, 'dist/index.js'),
    '--config', path.join(__dirname, 'config/freetakserver.json')
  ], {
    env: {
      ...process.env,
      TAK_SERVER_URL: 'http://localhost:19023',
      MCP_TRANSPORT: 'stdio',
      LOG_LEVEL: 'info'
    }
  });

  let messageId = 1;
  const responses = new Map();

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const message = JSON.parse(line);
        if (message.id) {
          responses.set(message.id, message);
        }
        console.log('📥 Response:', JSON.stringify(message, null, 2));
      } catch (e) {
        if (line.trim() && !line.includes('INFO') && !line.includes('DEBUG')) {
          console.log('   Server:', line);
        }
      }
    });
  });

  server.stderr.on('data', (data) => {
    console.error('❌ Error:', data.toString());
  });

  function sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: messageId++,
      method,
      params
    };
    
    console.log('\n📤 Request:', JSON.stringify(request, null, 2));
    server.stdin.write(JSON.stringify(request) + '\n');
    return request.id;
  }

  async function waitForResponse(id, timeout = 5000) {
    const start = Date.now();
    while (!responses.has(id) && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return responses.get(id);
  }

  // Start testing
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n🧪 Running MCP Tests with FreeTAKServer...\n');

  // Initialize
  const initId = sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {}
  });
  await waitForResponse(initId);

  // Test 1: List tools
  console.log('\n1️⃣ Test: List available tools');
  const toolsId = sendRequest('tools/list');
  const toolsResponse = await waitForResponse(toolsId);
  console.log(`   Found ${toolsResponse?.result?.tools?.length || 0} tools available`);

  // Test 2: Send a CoT event
  console.log('\n2️⃣ Test: Send CoT event');
  const cotId = sendRequest('tools/call', {
    name: 'tak_send_cot_event',
    arguments: {
      event: {
        _attributes: {
          version: '2.0',
          uid: `MCP-FTS-TEST-${Date.now()}`,
          type: 'a-f-G-U-C',
          time: new Date().toISOString(),
          start: new Date().toISOString(),
          stale: new Date(Date.now() + 3600000).toISOString(),
          how: 'm-g'
        },
        point: {
          _attributes: {
            lat: '37.7749',
            lon: '-122.4194',
            hae: '0',
            ce: '10',
            le: '10'
          }
        },
        detail: {
          contact: {
            _attributes: {
              callsign: 'MCP-TEST-UNIT'
            }
          },
          status: {
            _attributes: {
              text: 'Testing FreeTAKServer MCP Integration'
            }
          }
        }
      }
    }
  });
  await waitForResponse(cotId);

  // Test 3: Get CoT events
  console.log('\n3️⃣ Test: Get recent CoT events');
  const getCotsId = sendRequest('tools/call', {
    name: 'tak_get_cot_events',
    arguments: {
      limit: 5
    }
  });
  await waitForResponse(getCotsId);

  // Test 4: Calculate distance
  console.log('\n4️⃣ Test: Calculate distance');
  const distanceId = sendRequest('tools/call', {
    name: 'tak_calculate_distance',
    arguments: {
      from: { coordinates: [37.7749, -122.4194] },
      to: { coordinates: [37.7849, -122.4094] },
      units: 'kilometers'
    }
  });
  await waitForResponse(distanceId);

  // Test 5: Create geofence
  console.log('\n5️⃣ Test: Create geofence');
  const geofenceId = sendRequest('tools/call', {
    name: 'tak_create_geofence',
    arguments: {
      name: 'Test Security Zone',
      shape: {
        type: 'circle',
        center: [37.7749, -122.4194],
        radius: 1000
      },
      alertLevel: 'medium'
    }
  });
  await waitForResponse(geofenceId);

  // Test 6: Send emergency
  console.log('\n6️⃣ Test: Send emergency alert');
  const emergencyId = sendRequest('tools/call', {
    name: 'tak_send_emergency',
    arguments: {
      type: '911',
      message: 'Test emergency - THIS IS ONLY A TEST',
      location: {
        coordinates: [37.7749, -122.4194]
      },
      callsign: 'TEST-UNIT',
      severity: 'high'
    }
  });
  await waitForResponse(emergencyId);

  // Wait a bit for all responses
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n✅ Tests completed!');
  console.log('\n📊 Summary:');
  console.log(`   Total requests sent: ${messageId - 1}`);
  console.log(`   Responses received: ${responses.size}`);
  
  server.kill();
}

// Main execution
async function main() {
  console.log('=' * 60);
  console.log('TAK Server MCP - FreeTAKServer Integration Test');
  console.log('=' * 60 + '\n');

  // Check if FreeTAKServer is running
  const ftsRunning = await checkFreeTAKServer();
  
  if (!ftsRunning) {
    console.log('⚠️  Please start FreeTAKServer first!\n');
    process.exit(1);
  }

  // Run MCP tests
  await runMCPTests();
  
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});