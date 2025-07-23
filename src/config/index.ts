import fs from 'fs';
import path from 'path';
import Joi from 'joi';

export interface TAKServerConfig {
  url: string;
  apiToken?: string;
  clientCert?: string;
  clientKey?: string;
  verifySsl: boolean;
}

export interface MCPConfig {
  transport: 'stdio' | 'http' | 'sse';
  port?: number;
  auth?: {
    enabled: boolean;
    method?: 'oauth2' | 'apikey' | 'basic';
    oauth?: {
      clientId: string;
      clientSecret: string;
      authorizationUrl?: string;
      tokenUrl?: string;
      scope?: string;
    };
  };
}

export interface ToolsConfig {
  enabledTools?: string[];
  geospatial?: {
    defaultRadius: number;
    coordinateSystem: 'wgs84' | 'mgrs';
    h3Resolution: number;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface Config {
  takServer: TAKServerConfig;
  mcp: MCPConfig;
  tools: ToolsConfig;
}

const configSchema = Joi.object({
  takServer: Joi.object({
    url: Joi.string().uri().required(),
    apiToken: Joi.string().optional(),
    clientCert: Joi.string().optional(),
    clientKey: Joi.string().optional(),
    verifySsl: Joi.boolean().default(true)
  }).required(),
  mcp: Joi.object({
    transport: Joi.string().valid('stdio', 'http', 'sse').default('stdio'),
    port: Joi.number().port().when('transport', {
      is: Joi.string().valid('http', 'sse'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    auth: Joi.object({
      enabled: Joi.boolean().default(false),
      method: Joi.string().valid('oauth2', 'apikey', 'basic').optional(),
      oauth: Joi.object({
        clientId: Joi.string().required(),
        clientSecret: Joi.string().required(),
        authorizationUrl: Joi.string().uri().optional(),
        tokenUrl: Joi.string().uri().optional(),
        scope: Joi.string().optional()
      }).optional()
    }).optional()
  }).required(),
  tools: Joi.object({
    enabledTools: Joi.array().items(Joi.string()).optional(),
    geospatial: Joi.object({
      defaultRadius: Joi.number().default(1000),
      coordinateSystem: Joi.string().valid('wgs84', 'mgrs').default('wgs84'),
      h3Resolution: Joi.number().min(0).max(15).default(9)
    }).default(),
    cache: Joi.object({
      enabled: Joi.boolean().default(true),
      ttl: Joi.number().default(3600),
      maxSize: Joi.number().default(1000)
    }).default()
  }).default()
});

export function getConfig(): Config {
  let config: Partial<Config> = {};

  // Load from config file if exists
  const configPath = process.env.TAK_MCP_CONFIG || path.join(process.cwd(), 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...config, ...fileConfig };
    } catch (error) {
      console.error(`Failed to load config from ${configPath}:`, error);
    }
  }

  // Override with environment variables
  config.takServer = {
    ...config.takServer,
    url: process.env.TAK_SERVER_URL || config.takServer?.url || '',
    apiToken: process.env.TAK_SERVER_API_TOKEN || config.takServer?.apiToken,
    clientCert: process.env.TAK_SERVER_CLIENT_CERT || config.takServer?.clientCert,
    clientKey: process.env.TAK_SERVER_CLIENT_KEY || config.takServer?.clientKey,
    verifySsl: process.env.TAK_SERVER_VERIFY_SSL !== 'false'
  };

  config.mcp = {
    ...config.mcp,
    transport: (process.env.MCP_TRANSPORT as any) || config.mcp?.transport || 'stdio',
    port: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : config.mcp?.port
  };

  if (process.env.MCP_AUTH_ENABLED === 'true') {
    config.mcp.auth = {
      enabled: true,
      method: (process.env.MCP_AUTH_METHOD as any) || config.mcp?.auth?.method || 'apikey'
    };

    if (config.mcp.auth.method === 'oauth2') {
      config.mcp.auth.oauth = {
        clientId: process.env.MCP_OAUTH_CLIENT_ID || config.mcp.auth.oauth?.clientId || '',
        clientSecret: process.env.MCP_OAUTH_CLIENT_SECRET || config.mcp.auth.oauth?.clientSecret || '',
        authorizationUrl: process.env.MCP_OAUTH_AUTH_URL || config.mcp.auth.oauth?.authorizationUrl,
        tokenUrl: process.env.MCP_OAUTH_TOKEN_URL || config.mcp.auth.oauth?.tokenUrl,
        scope: process.env.MCP_OAUTH_SCOPE || config.mcp.auth.oauth?.scope
      };
    }
  }

  // Validate configuration
  const { error, value } = configSchema.validate(config);
  if (error) {
    throw new Error(`Invalid configuration: ${error.message}`);
  }

  return value as Config;
}