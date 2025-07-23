#!/usr/bin/env node

const net = require('net');
const xml2js = require('fast-xml-parser');

console.log('🚀 Testing Taky TAK Server connection at 192.168.1.124:8087\n');

// First, let's test direct TCP connection to Taky
const client = net.createConnection({ port: 8087, host: '192.168.1.124' }, () => {
  console.log('✅ Connected to Taky server on TCP port 8087');
  
  // Send a basic CoT message
  const cotMessage = `<?xml version="1.0" encoding="UTF-8"?>
<event version="2.0" uid="TEST-MCP-${Date.now()}" type="a-f-G-U-C" time="${new Date().toISOString()}" start="${new Date().toISOString()}" stale="${new Date(Date.now() + 3600000).toISOString()}" how="m-g">
  <point lat="37.7749" lon="-122.4194" hae="0" ce="10" le="10"/>
  <detail>
    <contact callsign="MCP-TEST"/>
    <status text="Testing MCP connection"/>
  </detail>
</event>`;

  console.log('\n📤 Sending test CoT message...');
  client.write(cotMessage);
});

client.on('data', (data) => {
  console.log('\n📥 Received data from Taky:');
  console.log(data.toString());
  
  // Parse if it's XML
  try {
    const parser = new xml2js.XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(data.toString());
    console.log('\nParsed CoT event:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    // Not XML, just log as is
  }
});

client.on('error', (err) => {
  console.error('❌ Connection error:', err.message);
});

client.on('close', () => {
  console.log('\n🔌 Connection closed');
});

// Now let's also test the MCP server with Taky configuration
setTimeout(() => {
  console.log('\n\n📡 Now testing MCP server with Taky configuration...\n');
  
  const { spawn } = require('child_process');
  const path = require('path');
  
  const server = spawn('node', [
    path.join(__dirname, 'dist/index.js'),
    '--config', path.join(__dirname, 'config/taky-server.json')
  ], {
    env: {
      ...process.env,
      TAK_SERVER_URL: 'http://192.168.1.124:8087',
      MCP_TRANSPORT: 'stdio',
      LOG_LEVEL: 'debug'
    }
  });

  let messageId = 1;

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const message = JSON.parse(line);
        console.log('MCP Response:', JSON.stringify(message, null, 2));
      } catch (e) {
        if (line.trim()) {
          console.log('MCP Server:', line);
        }
      }
    });
  });

  server.stderr.on('data', (data) => {
    console.error('MCP Error:', data.toString());
  });

  function sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: messageId++,
      method,
      params
    };
    
    console.log('\nMCP Request:', JSON.stringify(request, null, 2));
    server.stdin.write(JSON.stringify(request) + '\n');
  }

  // Initialize MCP
  setTimeout(() => {
    sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {}
    });

    // Test sending a CoT event through MCP
    setTimeout(() => {
      console.log('\n🧪 Sending CoT event through MCP...');
      sendRequest('tools/call', {
        name: 'tak_send_cot_event',
        arguments: {
          event: {
            _attributes: {
              version: '2.0',
              uid: `MCP-TEST-${Date.now()}`,
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
                  text: 'Testing TAK Server MCP'
                }
              }
            }
          }
        }
      });

      // Test getting events
      setTimeout(() => {
        console.log('\n🧪 Getting CoT events through MCP...');
        sendRequest('tools/call', {
          name: 'tak_get_cot_events',
          arguments: {
            limit: 5
          }
        });

        setTimeout(() => {
          console.log('\n✅ Tests completed. Shutting down...');
          server.kill();
          client.end();
          process.exit(0);
        }, 3000);
      }, 2000);
    }, 2000);
  }, 1000);
}, 2000);

// Handle termination
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  client.end();
  process.exit(0);
});