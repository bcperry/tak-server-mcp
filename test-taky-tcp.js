#!/usr/bin/env node

const net = require('net');

console.log('🚀 Testing direct TCP connection to Taky at 192.168.1.124:8087\n');

const client = net.createConnection({ port: 8087, host: '192.168.1.124' }, () => {
  console.log('✅ Connected to Taky server!');
  
  // Send a test CoT message
  const timestamp = new Date().toISOString();
  const stale = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
  
  const cotXML = `<?xml version="1.0" encoding="UTF-8"?>
<event version="2.0" uid="MCP-TEST-${Date.now()}" type="a-f-G-U-C" time="${timestamp}" start="${timestamp}" stale="${stale}" how="m-g">
  <point lat="37.7749" lon="-122.4194" hae="0" ce="10" le="10"/>
  <detail>
    <contact callsign="MCP-TEST-UNIT" phone="+1234567890"/>
    <status text="Testing TAK Server MCP integration"/>
    <track speed="0" course="0"/>
  </detail>
</event>`;

  console.log('📤 Sending CoT message:');
  console.log(cotXML);
  
  client.write(cotXML);
  console.log('\n✅ Message sent!');
});

client.on('data', (data) => {
  console.log('\n📥 Received from Taky:');
  console.log(data.toString());
});

client.on('error', (err) => {
  console.error('\n❌ Error:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.log('\n💡 Make sure Taky is running on 192.168.1.124:8087');
    console.log('   You can start Taky with: taky -c /path/to/taky.conf');
  }
});

client.on('close', () => {
  console.log('\n🔌 Connection closed');
});

// Send a few more messages
setTimeout(() => {
  if (client.readyState === 'open') {
    const timestamp = new Date().toISOString();
    const stale = new Date(Date.now() + 3600000).toISOString();
    
    const cotXML2 = `<?xml version="1.0" encoding="UTF-8"?>
<event version="2.0" uid="MCP-TEST-2-${Date.now()}" type="a-h-G-U-C" time="${timestamp}" start="${timestamp}" stale="${stale}" how="m-g">
  <point lat="37.7849" lon="-122.4094" hae="0" ce="10" le="10"/>
  <detail>
    <contact callsign="HOSTILE-TEST"/>
    <status text="Test hostile unit"/>
  </detail>
</event>`;
    
    console.log('\n📤 Sending second CoT message (hostile unit)...');
    client.write(cotXML2);
  }
}, 1000);

// Close after 5 seconds
setTimeout(() => {
  console.log('\n⏱️  Closing connection...');
  client.end();
}, 5000);

process.on('SIGINT', () => {
  console.log('\n\nInterrupted, closing connection...');
  client.destroy();
  process.exit(0);
});