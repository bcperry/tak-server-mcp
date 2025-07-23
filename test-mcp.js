#!/usr/bin/env node

// Simple test script to verify MCP server is working
import { spawn } from 'child_process';
import readline from 'readline';

console.log('Starting TAK Server MCP test...\n');

// Set test environment variables
const env = {
  ...process.env,
  TAK_SERVER_URL: process.env.TAK_SERVER_URL || 'https://localhost:8443',
  TAK_SERVER_API_TOKEN: process.env.TAK_SERVER_API_TOKEN || 'test-token',
  TAK_SERVER_VERIFY_SSL: 'false',
  MCP_TRANSPORT: 'stdio',
  LOG_LEVEL: 'debug'
};

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  env,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let requestId = 1;

// Handle server output
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      console.log('Server response:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Server output:', line);
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Send JSON-RPC request
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };
  
  console.log('\nSending request:', JSON.stringify(request, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');
}

// Test sequence
async function runTests() {
  console.log('Running MCP server tests...\n');
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 1: Initialize
  console.log('\n=== Test 1: Initialize ===');
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: List tools
  console.log('\n=== Test 2: List Tools ===');
  sendRequest('tools/list');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Call a tool
  console.log('\n=== Test 3: Call Tool - tak_get_cot_events ===');
  sendRequest('tools/call', {
    name: 'tak_get_cot_events',
    arguments: {
      limit: 5
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Send CoT event
  console.log('\n=== Test 4: Call Tool - tak_send_cot_event ===');
  sendRequest('tools/call', {
    name: 'tak_send_cot_event',
    arguments: {
      callsign: 'MCP-TEST-1',
      location: {
        lat: 37.7749,
        lon: -122.4194,
        alt: 100
      },
      type: 'a-f-G-U-C'
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n=== Tests complete ===');
  console.log('You can now interact with the server. Type "exit" to quit.\n');
}

// Interactive mode
function startInteractive() {
  rl.question('Enter command (list, call <tool> <args>, exit): ', (answer) => {
    if (answer === 'exit') {
      server.kill();
      rl.close();
      return;
    }
    
    if (answer === 'list') {
      sendRequest('tools/list');
    } else if (answer.startsWith('call ')) {
      const parts = answer.substring(5).split(' ');
      const toolName = parts[0];
      const args = parts.slice(1).join(' ');
      
      try {
        const parsedArgs = args ? JSON.parse(args) : {};
        sendRequest('tools/call', {
          name: toolName,
          arguments: parsedArgs
        });
      } catch (e) {
        console.error('Invalid JSON arguments:', e.message);
      }
    } else {
      console.log('Unknown command');
    }
    
    // Continue interactive mode
    setTimeout(() => startInteractive(), 100);
  });
}

// Run tests then start interactive mode
runTests().then(() => {
  startInteractive();
}).catch(error => {
  console.error('Test error:', error);
  server.kill();
  process.exit(1);
});