import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

export interface MCPClientConfig {
  url: string;
  transport: 'http' | 'ws' | 'sse';
  auth?: {
    type: 'bearer' | 'basic';
    credentials: string;
  };
}

export class MCPClient extends EventEmitter {
  private config: MCPClientConfig;
  private ws?: WebSocket;
  private axios?: AxiosInstance;
  private eventSource?: EventSource;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();

  constructor(config: MCPClientConfig) {
    super();
    this.config = config;

    if (config.transport === 'http') {
      this.axios = axios.create({
        baseURL: config.url,
        headers: this.getAuthHeaders()
      });
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.auth) {
      if (this.config.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${this.config.auth.credentials}`;
      } else if (this.config.auth.type === 'basic') {
        headers['Authorization'] = `Basic ${this.config.auth.credentials}`;
      }
    }

    return headers;
  }

  async connect(): Promise<void> {
    switch (this.config.transport) {
      case 'ws':
        return this.connectWebSocket();
      case 'sse':
        return this.connectSSE();
      case 'http':
        // HTTP doesn't need persistent connection
        return Promise.resolve();
      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url, {
        headers: this.getAuthHeaders()
      });

      this.ws.on('open', () => {
        console.log('MCP WebSocket connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle JSON-RPC responses
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
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.emit('disconnected');
      });
    });
  }

  private connectSSE(): Promise<void> {
    // SSE implementation would go here for browser environments
    // For Node.js, we'd need a different approach
    throw new Error('SSE transport not implemented for Node.js environment');
  }

  async listTools(): Promise<any[]> {
    const response = await this.callMethod('tools/list', {});
    return response.tools || [];
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.callMethod('tools/call', {
      name,
      arguments: args
    });
  }

  private async callMethod(method: string, params: any): Promise<any> {
    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    switch (this.config.transport) {
      case 'http':
        return this.httpCall(request);
      case 'ws':
        return this.wsCall(request);
      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }
  }

  private async httpCall(request: any): Promise<any> {
    if (!this.axios) {
      throw new Error('HTTP client not initialized');
    }

    const response = await this.axios.post('/mcp', request);
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    return response.data.result;
  }

  private wsCall(request: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });
      
      this.ws!.send(JSON.stringify(request));
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    
    this.removeAllListeners();
  }
}