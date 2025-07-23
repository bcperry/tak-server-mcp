# TAK Server MCP Integration Guide

This guide provides comprehensive documentation for integrating TAK Server MCP with various AI frameworks and LLM providers.

## Table of Contents

1. [Claude Desktop Integration](#claude-desktop-integration)
2. [Anthropic SDK (ADK) Integration](#anthropic-sdk-adk-integration)
3. [LangChain Integration](#langchain-integration)
4. [AI SDK Integration](#ai-sdk-integration)
5. [Claude Web Integration](#claude-web-integration)
6. [OpenAI Integration](#openai-integration)
7. [Google Gemini Integration](#google-gemini-integration)
8. [Custom Integration](#custom-integration)

## Claude Desktop Integration

Claude Desktop supports MCP servers natively through its configuration file.

### Configuration

1. Locate your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the TAK Server MCP configuration:

```json
{
  "mcpServers": {
    "tak-server": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "TAK_SERVER_URL=https://your-tak-server.com",
        "-e", "TAK_SERVER_API_TOKEN=your-api-token",
        "-e", "MCP_TRANSPORT=stdio",
        "skyfi/tak-server-mcp:latest"
      ]
    }
  }
}
```

### Using with Client Certificates

```json
{
  "mcpServers": {
    "tak-server-secure": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "/path/to/certs:/app/certs:ro",
        "-e", "TAK_SERVER_URL=https://secure-tak-server.com",
        "-e", "TAK_SERVER_CLIENT_CERT=/app/certs/client.crt",
        "-e", "TAK_SERVER_CLIENT_KEY=/app/certs/client.key",
        "-e", "MCP_TRANSPORT=stdio",
        "skyfi/tak-server-mcp:latest"
      ]
    }
  }
}
```

### Example Prompts

Once configured, you can use natural language to interact with TAK Server:

```
"Show me all blue force units within 10km of coordinates 37.7749, -122.4194"

"What aircraft are currently in the air?"

"Create a geofence around the base perimeter and alert me if any unknown entities enter"

"Analyze movement patterns of all ground units over the past hour"
```

## Anthropic SDK (ADK) Integration

The Anthropic SDK provides programmatic access to Claude with MCP support.

### Installation

```bash
npm install @anthropic-ai/sdk @modelcontextprotocol/sdk
```

### Basic Integration

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { MCPClient } from '@modelcontextprotocol/sdk';

// Initialize MCP client
const mcpClient = new MCPClient({
  serverUrl: 'http://localhost:3000',
  headers: {
    'Authorization': 'Bearer your-mcp-token'
  }
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Connect to MCP server
await mcpClient.connect();

// Get available tools
const tools = await mcpClient.listTools();

// Create a message with MCP tools
const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  tools: tools,
  messages: [
    {
      role: 'user',
      content: 'Find all hostile aircraft within 50km of base Alpha and provide threat assessment'
    }
  ],
  tool_choice: { type: 'auto' }
});

// Handle tool calls
if (message.stop_reason === 'tool_use') {
  for (const toolUse of message.content) {
    if (toolUse.type === 'tool_use') {
      const result = await mcpClient.callTool(
        toolUse.name,
        toolUse.input
      );
      console.log('Tool result:', result);
    }
  }
}
```

### Streaming Integration

```typescript
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import { MCPStreamClient } from '@modelcontextprotocol/sdk';

const mcpStream = new MCPStreamClient({
  serverUrl: 'ws://localhost:3000/stream',
  reconnect: true
});

const anthropic = new AnthropicBedrock({
  awsRegion: 'us-east-1'
});

// Stream real-time TAK events
mcpStream.on('tak-event', async (event) => {
  // Process incoming TAK events with Claude
  const analysis = await anthropic.messages.create({
    model: 'anthropic.claude-3-sonnet-20240229-v1:0',
    messages: [
      {
        role: 'user',
        content: `Analyze this TAK event: ${JSON.stringify(event)}`
      }
    ]
  });
  
  console.log('Event analysis:', analysis);
});

// Subscribe to specific event types
await mcpStream.subscribe({
  eventTypes: ['a-h-*'], // All hostile tracks
  spatialFilter: {
    center: [37.7749, -122.4194],
    radius: 100000 // 100km
  }
});
```

## LangChain Integration

LangChain provides a flexible framework for building LLM applications with tool support.

### Installation

```bash
pip install langchain langchain-anthropic requests
```

### Python Integration

```python
from langchain.tools import Tool
from langchain.agents import initialize_agent, AgentType
from langchain_anthropic import ChatAnthropic
import requests
import json

class TAKServerTool:
    def __init__(self, server_url, auth_token=None):
        self.server_url = server_url
        self.headers = {
            'Content-Type': 'application/json'
        }
        if auth_token:
            self.headers['Authorization'] = f'Bearer {auth_token}'
    
    def call_tool(self, tool_name, params):
        """Call a TAK Server MCP tool"""
        request = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/call',
            'params': {
                'name': tool_name,
                'arguments': params
            }
        }
        
        response = requests.post(
            f'{self.server_url}/mcp',
            json=request,
            headers=self.headers
        )
        
        return response.json()['result']

# Initialize TAK Server tool
tak_tool = TAKServerTool('http://localhost:3000')

# Create LangChain tools
spatial_query_tool = Tool(
    name="tak_spatial_query",
    description="Query TAK entities within a geographic area",
    func=lambda params: tak_tool.call_tool('tak_spatial_query', json.loads(params))
)

get_entities_tool = Tool(
    name="tak_get_entities",
    description="Get current TAK entity states",
    func=lambda params: tak_tool.call_tool('tak_get_entities', json.loads(params))
)

# Initialize agent
llm = ChatAnthropic(model="claude-3-opus-20240229")
agent = initialize_agent(
    tools=[spatial_query_tool, get_entities_tool],
    llm=llm,
    agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

# Use the agent
result = agent.run("""
Find all blue force ground units within 20km of coordinates 37.7749, -122.4194
and provide a summary of their current status and readiness.
""")

print(result)
```

### JavaScript/TypeScript Integration

```typescript
import { ChatAnthropic } from "@langchain/anthropic";
import { DynamicTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import axios from 'axios';

// TAK Server MCP client
class TAKServerMCP {
  constructor(private serverUrl: string, private authToken?: string) {}

  async callTool(toolName: string, params: any) {
    const response = await axios.post(`${this.serverUrl}/mcp`, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    }, {
      headers: {
        'Authorization': this.authToken ? `Bearer ${this.authToken}` : undefined
      }
    });

    return response.data.result;
  }
}

// Initialize MCP client
const takMCP = new TAKServerMCP('http://localhost:3000');

// Create dynamic tools
const spatialQueryTool = new DynamicTool({
  name: "tak_spatial_query",
  description: "Query TAK entities within a geographic area using center point and radius or polygon",
  func: async (input: string) => {
    const params = JSON.parse(input);
    const result = await takMCP.callTool('tak_spatial_query', params);
    return JSON.stringify(result);
  },
});

const getAlertsTool = new DynamicTool({
  name: "tak_get_alerts",
  description: "Get active alerts from TAK Server",
  func: async (input: string) => {
    const params = input ? JSON.parse(input) : {};
    const result = await takMCP.callTool('tak_get_alerts', params);
    return JSON.stringify(result);
  },
});

// Create agent
const model = new ChatAnthropic({
  modelName: "claude-3-opus-20240229",
  temperature: 0,
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a tactical analyst with access to TAK Server data. Use the tools to answer questions about the current tactical situation."],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const agent = createToolCallingAgent({
  llm: model,
  tools: [spatialQueryTool, getAlertsTool],
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools: [spatialQueryTool, getAlertsTool],
});

// Use the agent
const result = await agentExecutor.invoke({
  input: "Check for any active alerts near coordinates 37.7749, -122.4194 and analyze the threat level",
});

console.log(result.output);
```

## AI SDK Integration

The Vercel AI SDK provides a unified interface for multiple LLM providers.

### Installation

```bash
npm install ai @ai-sdk/anthropic
```

### Integration Example

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, tool } from 'ai';
import { z } from 'zod';

// Define TAK Server tools
const takTools = {
  spatial_query: tool({
    description: 'Query TAK entities within a geographic area',
    parameters: z.object({
      center: z.array(z.number()).length(2).describe('Center point [lat, lon]'),
      radius: z.number().describe('Search radius in meters'),
      types: z.array(z.string()).optional().describe('Entity type filters'),
    }),
    execute: async ({ center, radius, types }) => {
      const response = await fetch('http://localhost:3000/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'tak_spatial_query',
            arguments: { center, radius, types }
          }
        })
      });
      return response.json();
    }
  }),

  send_alert: tool({
    description: 'Send an alert to TAK Server',
    parameters: z.object({
      type: z.string(),
      message: z.string(),
      point: z.array(z.number()).length(2),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
    }),
    execute: async (params) => {
      const response = await fetch('http://localhost:3000/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'tak_send_alert',
            arguments: params
          }
        })
      });
      return response.json();
    }
  }),
};

// Use with AI SDK
const result = await generateText({
  model: anthropic('claude-3-opus-20240229'),
  tools: takTools,
  toolChoice: 'auto',
  prompt: 'Check for hostile forces within 50km of base coordinates 37.7749, -122.4194 and send a high priority alert if any are found',
});

console.log(result.text);
console.log('Tool calls:', result.toolCalls);
```

### Streaming with Real-time Updates

```typescript
import { streamText } from 'ai';
import { createMCPStreamAdapter } from './mcp-stream-adapter';

// Create streaming adapter for real-time TAK events
const mcpStream = createMCPStreamAdapter({
  url: 'ws://localhost:3000/stream',
  onEvent: (event) => {
    console.log('TAK Event:', event);
  }
});

// Stream with real-time context
const stream = await streamText({
  model: anthropic('claude-3-opus-20240229'),
  tools: takTools,
  system: 'You are monitoring a live TAK feed. Analyze events as they occur.',
  messages: [
    {
      role: 'user',
      content: 'Monitor for any emergency signals and provide immediate analysis',
    },
    // Inject real-time events as they arrive
    ...mcpStream.getEventMessages(),
  ],
});

for await (const part of stream.textStream) {
  process.stdout.write(part);
}
```

## Claude Web Integration

For web-based applications using Claude's API directly.

### Browser Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>TAK Server MCP Web Client</title>
</head>
<body>
  <div id="chat"></div>
  <script type="module">
    import { AnthropicClient } from 'https://cdn.skypack.dev/@anthropic-ai/sdk';
    
    class TAKServerMCPWeb {
      constructor(serverUrl) {
        this.serverUrl = serverUrl;
      }
      
      async callTool(toolName, params) {
        const response = await fetch(`${this.serverUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: params
            }
          })
        });
        
        return response.json();
      }
      
      async streamEvents(callback) {
        const eventSource = new EventSource(`${this.serverUrl}/sse`);
        
        eventSource.addEventListener('tak-event', (event) => {
          const data = JSON.parse(event.data);
          callback(data);
        });
        
        return eventSource;
      }
    }
    
    // Initialize clients
    const takMCP = new TAKServerMCPWeb('http://localhost:3000');
    const anthropic = new AnthropicClient({
      apiKey: 'your-api-key',
      dangerouslyAllowBrowser: true // Only for demo
    });
    
    // Real-time event monitoring
    const eventStream = await takMCP.streamEvents((event) => {
      console.log('TAK Event:', event);
      // Update UI with event
      document.getElementById('chat').innerHTML += 
        `<div>New event: ${event.type} at ${event.location}</div>`;
    });
    
    // Query TAK Server through Claude
    async function queryTAK(question) {
      const tools = [
        {
          name: 'tak_spatial_query',
          description: 'Query entities in an area',
          input_schema: {
            type: 'object',
            properties: {
              center: { type: 'array' },
              radius: { type: 'number' }
            }
          }
        }
      ];
      
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        tools: tools,
        messages: [
          { role: 'user', content: question }
        ]
      });
      
      // Handle tool calls
      for (const content of response.content) {
        if (content.type === 'tool_use') {
          const result = await takMCP.callTool(
            content.name,
            content.input
          );
          console.log('Tool result:', result);
        }
      }
      
      return response;
    }
    
    // Example usage
    queryTAK('Show me all units within 5km of my location');
  </script>
</body>
</html>
```

## OpenAI Integration

While OpenAI doesn't natively support MCP, you can create a compatible interface.

### Function Calling Integration

```python
import openai
import requests
import json

class TAKServerMCPAdapter:
    def __init__(self, mcp_url):
        self.mcp_url = mcp_url
        self.tools = self._load_tools()
    
    def _load_tools(self):
        """Load MCP tools and convert to OpenAI function format"""
        response = requests.post(f'{self.mcp_url}/mcp', json={
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/list'
        })
        
        mcp_tools = response.json()['result']['tools']
        
        # Convert to OpenAI function format
        functions = []
        for tool in mcp_tools:
            functions.append({
                'name': tool['name'],
                'description': tool['description'],
                'parameters': tool.get('inputSchema', {})
            })
        
        return functions
    
    def call_function(self, name, arguments):
        """Call MCP tool through OpenAI function interface"""
        response = requests.post(f'{self.mcp_url}/mcp', json={
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/call',
            'params': {
                'name': name,
                'arguments': arguments
            }
        })
        
        return response.json()['result']

# Initialize adapter
tak_adapter = TAKServerMCPAdapter('http://localhost:3000')

# Use with OpenAI
client = openai.OpenAI()

response = client.chat.completions.create(
    model="gpt-4-turbo-preview",
    messages=[
        {
            "role": "user",
            "content": "Find all hostile aircraft within 100km of base Alpha"
        }
    ],
    functions=tak_adapter.tools,
    function_call="auto"
)

# Handle function calls
if response.choices[0].message.function_call:
    function_call = response.choices[0].message.function_call
    result = tak_adapter.call_function(
        function_call.name,
        json.loads(function_call.arguments)
    )
    
    # Send result back to OpenAI
    follow_up = client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[
            {
                "role": "user",
                "content": "Find all hostile aircraft within 100km of base Alpha"
            },
            response.choices[0].message,
            {
                "role": "function",
                "name": function_call.name,
                "content": json.dumps(result)
            }
        ]
    )
    
    print(follow_up.choices[0].message.content)
```

## Google Gemini Integration

Gemini supports function calling which can be adapted for MCP.

### Python Integration

```python
import google.generativeai as genai
import requests
import json

class GeminiTAKAdapter:
    def __init__(self, mcp_url):
        self.mcp_url = mcp_url
    
    def create_tools(self):
        """Create Gemini-compatible tool definitions"""
        tak_spatial_query = genai.protos.Tool(
            function_declarations=[
                genai.protos.FunctionDeclaration(
                    name='tak_spatial_query',
                    description='Query TAK entities within a geographic area',
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            'center': genai.protos.Schema(
                                type=genai.protos.Type.ARRAY,
                                items=genai.protos.Schema(type=genai.protos.Type.NUMBER)
                            ),
                            'radius': genai.protos.Schema(type=genai.protos.Type.NUMBER),
                            'types': genai.protos.Schema(
                                type=genai.protos.Type.ARRAY,
                                items=genai.protos.Schema(type=genai.protos.Type.STRING)
                            )
                        },
                        required=['center', 'radius']
                    )
                )
            ]
        )
        
        return [tak_spatial_query]
    
    def call_mcp_tool(self, function_call):
        """Execute MCP tool from Gemini function call"""
        response = requests.post(f'{self.mcp_url}/mcp', json={
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/call',
            'params': {
                'name': function_call.name,
                'arguments': json.loads(function_call.args)
            }
        })
        
        return response.json()['result']

# Configure Gemini
genai.configure(api_key='your-api-key')
model = genai.GenerativeModel('gemini-pro')

# Initialize TAK adapter
tak_adapter = GeminiTAKAdapter('http://localhost:3000')

# Create chat with tools
chat = model.start_chat(
    enable_automatic_function_calling=True,
    tools=tak_adapter.create_tools()
)

# Send message
response = chat.send_message(
    "What military aircraft are within 50 miles of San Francisco?"
)

# Handle function calls
for part in response.parts:
    if part.function_call:
        result = tak_adapter.call_mcp_tool(part.function_call)
        
        # Send result back to Gemini
        response = chat.send_message(
            genai.protos.Content(
                parts=[
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=part.function_call.name,
                            response={'result': result}
                        )
                    )
                ]
            )
        )

print(response.text)
```

## Custom Integration

For custom implementations or other LLM providers.

### Generic MCP Client

```typescript
export class MCPClient {
  private ws?: WebSocket;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private requestId = 0;

  constructor(private config: {
    url: string;
    transport: 'http' | 'ws' | 'sse';
    auth?: {
      type: 'bearer' | 'basic';
      credentials: string;
    };
  }) {}

  async connect(): Promise<void> {
    if (this.config.transport === 'ws') {
      return this.connectWebSocket();
    }
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.on('open', () => {
        console.log('WebSocket connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            reject(new Error(message.error.message));
          } else {
            resolve(message.result);
          }
        } else if (message.method === 'notification') {
          // Handle server-initiated notifications
          this.emit('notification', message.params);
        }
      });
      
      this.ws.on('error', reject);
    });
  }

  async callTool(name: string, args: any): Promise<any> {
    if (this.config.transport === 'http') {
      return this.httpCall('tools/call', { name, arguments: args });
    } else if (this.ws) {
      return this.wsCall('tools/call', { name, arguments: args });
    }
    throw new Error('Not connected');
  }

  private async httpCall(method: string, params: any): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (this.config.auth) {
      if (this.config.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${this.config.auth.credentials}`;
      } else if (this.config.auth.type === 'basic') {
        headers['Authorization'] = `Basic ${this.config.auth.credentials}`;
      }
    }
    
    const response = await fetch(`${this.config.url}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params
      })
    });
    
    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result.result;
  }

  private wsCall(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });
      
      this.ws!.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params
      }));
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async listTools(): Promise<any[]> {
    if (this.config.transport === 'http') {
      return this.httpCall('tools/list', {});
    } else if (this.ws) {
      return this.wsCall('tools/list', {});
    }
    throw new Error('Not connected');
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }
}

// Usage example
const client = new MCPClient({
  url: 'http://localhost:3000',
  transport: 'http',
  auth: {
    type: 'bearer',
    credentials: 'your-api-key'
  }
});

const tools = await client.listTools();
const result = await client.callTool('tak_get_entities', {
  types: ['a-f-G'], // Friendly ground forces
  bbox: [-122.5, 37.7, -122.3, 37.8]
});
```

## Best Practices

### 1. Error Handling

Always implement proper error handling for MCP calls:

```typescript
try {
  const result = await mcpClient.callTool('tak_spatial_query', params);
  // Process result
} catch (error) {
  if (error.code === 'UNAUTHORIZED') {
    // Handle authentication error
  } else if (error.code === 'TIMEOUT') {
    // Handle timeout
  } else {
    // Handle other errors
  }
}
```

### 2. Rate Limiting

Implement rate limiting to avoid overwhelming the TAK Server:

```typescript
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute'
});

async function callToolWithRateLimit(name: string, params: any) {
  await limiter.removeTokens(1);
  return mcpClient.callTool(name, params);
}
```

### 3. Caching

Cache frequently accessed data to improve performance:

```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5 // 5 minutes
});

async function getCachedEntities(params: any) {
  const key = JSON.stringify(params);
  
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await mcpClient.callTool('tak_get_entities', params);
  cache.set(key, result);
  
  return result;
}
```

### 4. Connection Management

Implement reconnection logic for streaming connections:

```typescript
class ResilientMCPClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  async connect() {
    try {
      await this.client.connect();
      this.reconnectAttempts = 0;
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms...`);
        setTimeout(() => this.connect(), delay);
      } else {
        throw new Error('Max reconnection attempts reached');
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if TAK Server MCP is running
   - Verify the correct port and transport
   - Check firewall settings

2. **Authentication Errors**
   - Verify API tokens or credentials
   - Check certificate paths and permissions
   - Ensure proper auth configuration

3. **Tool Not Found**
   - Use `listTools()` to see available tools
   - Check if tools are enabled in configuration
   - Verify tool names match exactly

4. **Timeout Errors**
   - Increase timeout settings
   - Check network connectivity
   - Verify TAK Server is responsive

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug MCP_VERBOSE=true npm start
```

## Additional Resources

- [TAK Server Documentation](https://tak.gov)
- [MCP Specification](https://modelcontextprotocol.io)
- [Example Projects](https://github.com/skyfi/tak-server-mcp/examples)
- [Community Forum](https://github.com/skyfi/tak-server-mcp/discussions)