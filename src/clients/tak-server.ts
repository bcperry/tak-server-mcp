import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import fs from 'fs';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Logger } from 'pino';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { CotEvent, CotMessage } from '../types/cot';
import { TAKEntity, Mission, DataPackage } from '../types/tak';

export interface TAKServerClientConfig {
  url: string;
  apiToken?: string;
  clientCert?: string;
  clientKey?: string;
  verifySsl?: boolean;
  timeout?: number;
  logger?: Logger;
}

export class TAKServerClient extends EventEmitter {
  private axios: AxiosInstance;
  private ws?: WebSocket;
  private config: TAKServerClientConfig;
  private logger?: Logger;

  constructor(config: TAKServerClientConfig) {
    super();
    this.config = config;
    this.logger = config.logger;

    // Configure axios instance
    const axiosConfig: AxiosRequestConfig = {
      baseURL: config.url,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    // Add authentication
    if (config.apiToken) {
      axiosConfig.headers!['Authorization'] = `Bearer ${config.apiToken}`;
    }

    // Configure HTTPS agent for client certificates
    if (config.clientCert && config.clientKey) {
      axiosConfig.httpsAgent = new https.Agent({
        cert: fs.readFileSync(config.clientCert),
        key: fs.readFileSync(config.clientKey),
        rejectUnauthorized: config.verifySsl !== false
      });
    } else if (config.verifySsl === false) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    this.axios = axios.create(axiosConfig);

    // Add request/response interceptors for logging
    if (this.logger) {
      this.axios.interceptors.request.use(
        (config) => {
          this.logger!.debug({ method: config.method, url: config.url }, 'TAK Server request');
          return config;
        },
        (error) => {
          this.logger!.error({ error }, 'TAK Server request error');
          return Promise.reject(error);
        }
      );

      this.axios.interceptors.response.use(
        (response) => {
          this.logger!.debug({ status: response.status, url: response.config.url }, 'TAK Server response');
          return response;
        },
        (error) => {
          this.logger!.error({ error: error.message, status: error.response?.status }, 'TAK Server response error');
          return Promise.reject(error);
        }
      );
    }
  }

  async testConnection(): Promise<void> {
    try {
      // TAK Server version endpoint
      const response = await this.axios.get('/Marti/api/version');
      this.logger?.info('Connected to TAK Server', { version: response.data });
    } catch (error) {
      throw new Error(`Failed to connect to TAK Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // CoT Event Management
  async getCotEvents(params?: {
    start?: Date;
    end?: Date;
    types?: string[];
    uids?: string[];
    bbox?: [number, number, number, number];
    limit?: number;
  }): Promise<CotEvent[]> {
    const events: CotEvent[] = [];
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true
    });

    // If specific UIDs provided, fetch each one
    if (params?.uids && params.uids.length > 0) {
      for (const uid of params.uids) {
        try {
          const response = await this.axios.get(`/api/cot/xml/${uid}`);
          const parsed = xmlParser.parse(response.data);
          if (parsed.event) {
            events.push(this.parseCotEvent(parsed.event));
          }
        } catch (error) {
          this.logger?.warn(`Failed to fetch CoT event for UID ${uid}:`, error);
        }
      }
    } else {
      // For history/search, TAK Server uses different endpoint
      for (const uid of params?.uids || ['*']) {
        let url = `/api/cot/xml/${uid}/all`;
        const queryParams = new URLSearchParams();
        
        if (params?.start) {
          queryParams.append('start', this.formatTAKDate(params.start));
        }
        if (params?.end) {
          queryParams.append('end', this.formatTAKDate(params.end));
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        try {
          const response = await this.axios.get(url, {
            headers: { 'Accept': 'application/xml' }
          });
          
          // Parse multiple events from response
          const eventMatches = response.data.match(/<event[^>]*>[\s\S]*?<\/event>/g);
          if (eventMatches) {
            for (const eventXml of eventMatches) {
              const parsed = xmlParser.parse(eventXml);
              if (parsed.event) {
                const event = this.parseCotEvent(parsed.event);
                // Filter by type if specified
                if (!params?.types || params.types.some(t => event.type.startsWith(t))) {
                  events.push(event);
                }
              }
            }
          }
        } catch (error) {
          this.logger?.error('Failed to fetch CoT history:', error);
        }
      }
    }

    // Apply limit if specified
    if (params?.limit && events.length > params.limit) {
      return events.slice(0, params.limit);
    }

    return events;
  }

  private formatTAKDate(date: Date): string {
    // TAK Server expects ISO format with milliseconds
    return date.toISOString();
  }

  private parseCotEvent(eventData: any): CotEvent {
    return {
      uid: eventData.uid,
      type: eventData.type,
      time: new Date(eventData.time),
      start: new Date(eventData.start),
      stale: new Date(eventData.stale),
      how: eventData.how,
      point: {
        lat: parseFloat(eventData.point.lat),
        lon: parseFloat(eventData.point.lon),
        hae: parseFloat(eventData.point.hae) || 999999,
        ce: parseFloat(eventData.point.ce) || 999999,
        le: parseFloat(eventData.point.le) || 999999
      },
      detail: eventData.detail
    };
  }

  async sendCotEvent(event: CotMessage): Promise<void> {
    const xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true
    });

    // Build XML from CotMessage
    const xml = xmlBuilder.build(event);
    
    // TAK Server expects XML in the body
    await this.axios.post('/Marti/api/cot/submit', xml, {
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }

  async subscribeToCotEvents(
    filter?: {
      types?: string[];
      bbox?: [number, number, number, number];
    },
    onEvent?: (event: CotEvent) => void
  ): Promise<void> {
    // TAK Server uses different WebSocket endpoint patterns
    const wsUrl = this.config.url.replace(/^https?/, 'wss') + '/Marti/api/takcl/ws';
    
    const wsOptions: WebSocket.ClientOptions = {
      rejectUnauthorized: this.config.verifySsl !== false
    };

    // Add authentication headers
    if (this.config.apiToken) {
      wsOptions.headers = {
        'Authorization': `Bearer ${this.config.apiToken}`
      };
    }

    // Add client certificate if configured
    if (this.config.clientCert && this.config.clientKey) {
      wsOptions.cert = fs.readFileSync(this.config.clientCert);
      wsOptions.key = fs.readFileSync(this.config.clientKey);
    }

    this.ws = new WebSocket(wsUrl, wsOptions);
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true
    });

    this.ws.on('open', () => {
      this.logger?.info('WebSocket connection established');
      // TAK Server may expect subscription message
      if (filter?.types) {
        const subscribeMsg = {
          type: 'subscribe',
          filters: filter.types
        };
        this.ws!.send(JSON.stringify(subscribeMsg));
      }
    });

    this.ws.on('message', (data) => {
      try {
        const message = data.toString();
        
        // TAK Server sends CoT events as XML
        if (message.includes('<event')) {
          const parsed = xmlParser.parse(message);
          if (parsed.event) {
            const event = this.parseCotEvent(parsed.event);
            this.emit('cot-event', event);
            if (onEvent) onEvent(event);
          }
        } else {
          // Handle other message types (JSON status messages, etc.)
          try {
            const jsonMsg = JSON.parse(message);
            this.logger?.debug('Received JSON message:', jsonMsg);
          } catch {
            this.logger?.debug('Received non-JSON message:', message);
          }
        }
      } catch (error) {
        this.logger?.error('Failed to parse WebSocket message:', error);
      }
    });

    this.ws.on('error', (error) => {
      this.logger?.error('WebSocket error:', error);
      this.emit('error', error);
    });

    this.ws.on('close', () => {
      this.logger?.info('WebSocket connection closed');
      this.emit('disconnected');
    });
  }

  async unsubscribe(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  // Entity Management
  async getEntities(params?: {
    types?: string[];
    teams?: string[];
    roles?: string[];
    bbox?: [number, number, number, number];
  }): Promise<TAKEntity[]> {
    // TAK Server doesn't have a direct "entities" endpoint
    // We need to get CoT events and transform them to entities
    const events = await this.getCotEvents({
      types: params?.types,
      bbox: params?.bbox,
      limit: 1000 // Get recent events
    });

    // Transform CoT events to TAK entities
    const entitiesMap = new Map<string, TAKEntity>();
    
    for (const event of events) {
      // Use the most recent event for each UID
      if (!entitiesMap.has(event.uid) || 
          new Date(event.time) > new Date(entitiesMap.get(event.uid)!.lastUpdate)) {
        
        const entity: TAKEntity = {
          uid: event.uid,
          callsign: event.detail?.contact?.callsign || event.uid,
          type: event.type,
          team: event.detail?.group?.name || 'Unknown',
          role: event.detail?.group?.role || 'Unknown',
          location: {
            lat: event.point.lat,
            lon: event.point.lon,
            alt: event.point.hae !== 999999 ? event.point.hae : undefined
          },
          lastUpdate: event.time,
          status: {
            online: new Date(event.stale) > new Date(),
            battery: event.detail?.status?.battery,
            speed: event.detail?.track?.speed,
            course: event.detail?.track?.course,
            readiness: event.detail?.status?.readiness ? 'ready' : 'unknown'
          },
          attributes: event.detail
        };

        // Apply filters
        if (params?.teams && !params.teams.includes(entity.team)) continue;
        if (params?.roles && !params.roles.includes(entity.role)) continue;
        
        entitiesMap.set(event.uid, entity);
      }
    }

    return Array.from(entitiesMap.values());
  }

  async getEntity(uid: string): Promise<TAKEntity> {
    // Get the specific CoT event for this UID
    const response = await this.axios.get(`/api/cot/xml/${uid}`);
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true
    });
    
    const parsed = xmlParser.parse(response.data);
    if (!parsed.event) {
      throw new Error(`Entity not found: ${uid}`);
    }
    
    const event = this.parseCotEvent(parsed.event);
    
    // Transform to TAKEntity
    return {
      uid: event.uid,
      callsign: event.detail?.contact?.callsign || event.uid,
      type: event.type,
      team: event.detail?.group?.name || 'Unknown',
      role: event.detail?.group?.role || 'Unknown',
      location: {
        lat: event.point.lat,
        lon: event.point.lon,
        alt: event.point.hae !== 999999 ? event.point.hae : undefined
      },
      lastUpdate: event.time,
      status: {
        online: new Date(event.stale) > new Date(),
        battery: event.detail?.status?.battery,
        speed: event.detail?.track?.speed,
        course: event.detail?.track?.course,
        readiness: event.detail?.status?.readiness ? 'ready' : 'unknown'
      },
      attributes: event.detail
    };
  }

  // Mission Management
  async getMissions(): Promise<Mission[]> {
    const response = await this.axios.get('/Marti/api/missions');
    return response.data;
  }

  async getMission(name: string): Promise<Mission> {
    const response = await this.axios.get(`/Marti/api/missions/${name}`);
    return response.data;
  }

  async createMission(mission: Partial<Mission>): Promise<Mission> {
    const response = await this.axios.post('/Marti/api/missions', mission);
    return response.data;
  }

  async updateMission(name: string, updates: Partial<Mission>): Promise<Mission> {
    const response = await this.axios.put(`/Marti/api/missions/${name}`, updates);
    return response.data;
  }

  async deleteMission(name: string): Promise<void> {
    await this.axios.delete(`/Marti/api/missions/${name}`);
  }

  // Data Package Management
  async getDataPackages(): Promise<DataPackage[]> {
    const response = await this.axios.get('/Marti/api/datapackages');
    return response.data;
  }

  async uploadDataPackage(file: Buffer, metadata: Partial<DataPackage>): Promise<DataPackage> {
    const formData = new FormData();
    formData.append('file', new Blob([file]));
    formData.append('metadata', JSON.stringify(metadata));

    const response = await this.axios.post('/Marti/api/datapackages', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  async downloadDataPackage(id: string): Promise<Buffer> {
    const response = await this.axios.get(`/Marti/api/datapackages/${id}`, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  }

  async deleteDataPackage(id: string): Promise<void> {
    await this.axios.delete(`/Marti/api/datapackages/${id}`);
  }

  // Geospatial Operations
  async spatialQuery(params: {
    center: [number, number];
    radius?: number;
    polygon?: [number, number][];
    types?: string[];
    timeWindow?: { start: Date; end: Date };
  }): Promise<CotEvent[]> {
    const response = await this.axios.post('/Marti/api/spatial/query', params);
    return response.data;
  }

  async calculateDistance(point1: [number, number], point2: [number, number]): Promise<number> {
    const response = await this.axios.post('/Marti/api/spatial/distance', { point1, point2 });
    return response.data.distance;
  }

  async findNearest(params: {
    point: [number, number];
    types?: string[];
    limit?: number;
    maxDistance?: number;
  }): Promise<Array<TAKEntity & { distance: number }>> {
    const response = await this.axios.post('/Marti/api/spatial/nearest', params);
    return response.data;
  }

  // Alert Management
  async getAlerts(active?: boolean): Promise<any[]> {
    const response = await this.axios.get(`/Marti/api/alerts${active !== undefined ? `?active=${active}` : ''}`);
    return response.data;
  }

  async sendAlert(alert: {
    type: string;
    message: string;
    point: [number, number];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    await this.axios.post('/Marti/api/alerts', alert);
  }

  // Cleanup
  async disconnect(): Promise<void> {
    await this.unsubscribe();
    this.removeAllListeners();
  }
}