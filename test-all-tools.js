#!/usr/bin/env node

/**
 * Comprehensive test script for all TAK Server MCP tools
 * This demonstrates how to use each implemented feature
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Test configuration - update these values
const TEST_CONFIG = {
  TAK_SERVER_URL: process.env.TAK_SERVER_URL || 'https://tak-server.example.com',
  TAK_SERVER_API_TOKEN: process.env.TAK_SERVER_API_TOKEN || 'your-api-token',
  TEST_ENTITY_ID: 'TEST-UNIT-001',
  TEST_LOCATION: [37.7749, -122.4194], // San Francisco
};

class MCPTestClient {
  constructor() {
    this.messageId = 1;
    this.server = null;
  }

  async start() {
    console.log('🚀 Starting TAK Server MCP...\n');
    
    this.server = spawn('node', ['dist/index.js'], {
      env: {
        ...process.env,
        TAK_SERVER_URL: TEST_CONFIG.TAK_SERVER_URL,
        TAK_SERVER_API_TOKEN: TEST_CONFIG.TAK_SERVER_API_TOKEN,
        MCP_TRANSPORT: 'stdio',
        LOG_LEVEL: 'debug'
      }
    });

    this.server.stdout.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleResponse(message);
      } catch (e) {
        // Not JSON, probably a log message
        console.log('Server:', data.toString());
      }
    });

    this.server.stderr.on('data', (data) => {
      console.error('Error:', data.toString());
    });

    // Initialize connection
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {}
    });

    await this.waitForResponse();
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };
    
    this.server.stdin.write(JSON.stringify(request) + '\n');
    return request.id;
  }

  handleResponse(message) {
    if (message.result || message.error) {
      this.lastResponse = message;
    }
  }

  async waitForResponse(timeout = 5000) {
    const start = Date.now();
    while (!this.lastResponse && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const response = this.lastResponse;
    this.lastResponse = null;
    return response;
  }

  async callTool(toolName, args = {}) {
    console.log(`\n📋 Testing: ${toolName}`);
    console.log('Parameters:', JSON.stringify(args, null, 2));
    
    await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    const response = await this.waitForResponse();
    
    if (response?.error) {
      console.error('❌ Error:', response.error);
    } else if (response?.result) {
      console.log('✅ Success:', JSON.stringify(response.result, null, 2));
    }
    
    return response;
  }

  async runAllTests() {
    console.log('🧪 Running comprehensive TAK Server MCP tests...\n');

    // Test 1: Get all missions
    await this.callTool('tak_get_missions', {
      createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Test 2: Get active alerts
    await this.callTool('tak_get_alerts', {
      active: true,
      severity: ['high', 'critical']
    });

    // Test 3: Calculate distance between two points
    await this.callTool('tak_calculate_distance', {
      from: { coordinates: TEST_CONFIG.TEST_LOCATION },
      to: { coordinates: [37.7849, -122.4094] }, // 1km away
      units: 'kilometers'
    });

    // Test 4: Find nearest entities
    await this.callTool('tak_find_nearest', {
      point: { coordinates: TEST_CONFIG.TEST_LOCATION },
      maxDistance: 5000,
      maxResults: 5,
      entityTypes: ['a-f-*'] // Friendly forces
    });

    // Test 5: Get current entities
    await this.callTool('tak_get_entities', {
      types: ['a-f-*'],
      excludeStale: true
    });

    // Test 6: Spatial query within area
    await this.callTool('tak_spatial_query', {
      center: TEST_CONFIG.TEST_LOCATION,
      radius: 10000, // 10km radius
      types: ['a-*']
    });

    // Test 7: Create a geofence
    await this.callTool('tak_create_geofence', {
      name: 'Test Security Zone',
      shape: {
        type: 'circle',
        center: TEST_CONFIG.TEST_LOCATION,
        radius: 1000
      },
      triggers: {
        onEntry: true,
        onExit: true
      },
      alertLevel: 'medium'
    });

    // Test 8: Analyze movement (if entity exists)
    await this.callTool('tak_analyze_movement', {
      entityId: TEST_CONFIG.TEST_ENTITY_ID,
      analysisType: ['speed', 'pattern', 'stops']
    });

    // Test 9: Send a test emergency alert
    await this.callTool('tak_send_emergency', {
      type: 'medical',
      message: 'Test medical emergency - THIS IS A TEST',
      location: { coordinates: TEST_CONFIG.TEST_LOCATION },
      callsign: 'TEST-UNIT',
      severity: 'high',
      notifyRadius: 2000
    });

    // Test 10: Subscribe to events (5 second test)
    await this.callTool('tak_subscribe_events', {
      types: ['a-*', 'b-*'],
      duration: 5,
      area: {
        center: TEST_CONFIG.TEST_LOCATION,
        radius: 50000
      }
    });

    // Test 11: List data packages
    await this.callTool('tak_manage_data_packages', {
      operation: 'list',
      filter: {
        createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    // Test 12: Get recent CoT events
    await this.callTool('tak_get_cot_events', {
      startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Last hour
      limit: 10
    });

    console.log('\n✅ All tests completed!');
  }

  async stop() {
    if (this.server) {
      this.server.kill();
    }
  }
}

// Interactive test mode
async function interactiveMode() {
  const client = new MCPTestClient();
  await client.start();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n🎮 Interactive Mode - Available tools:');
  console.log('1. tak_get_missions');
  console.log('2. tak_get_alerts');
  console.log('3. tak_calculate_distance');
  console.log('4. tak_find_nearest');
  console.log('5. tak_get_entities');
  console.log('6. tak_spatial_query');
  console.log('7. tak_create_geofence');
  console.log('8. tak_analyze_movement');
  console.log('9. tak_send_emergency');
  console.log('10. tak_subscribe_events');
  console.log('11. tak_manage_data_packages');
  console.log('12. tak_get_cot_events');
  console.log('13. tak_send_cot_event');
  console.log('\nType "exit" to quit or "all" to run all tests\n');

  const askQuestion = () => {
    rl.question('Enter tool name or command: ', async (answer) => {
      if (answer === 'exit') {
        await client.stop();
        rl.close();
        return;
      }

      if (answer === 'all') {
        await client.runAllTests();
      } else if (answer.startsWith('tak_')) {
        rl.question('Enter parameters (JSON): ', async (params) => {
          try {
            const args = params ? JSON.parse(params) : {};
            await client.callTool(answer, args);
          } catch (e) {
            console.error('Invalid JSON:', e.message);
          }
          askQuestion();
        });
        return;
      }

      askQuestion();
    });
  };

  askQuestion();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    // Run all tests automatically
    const client = new MCPTestClient();
    await client.start();
    await client.runAllTests();
    await client.stop();
  } else {
    // Interactive mode
    await interactiveMode();
  }
}

main().catch(console.error);