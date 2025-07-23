import { TAKTool, ToolContext } from '../registry';
import * as turf from '@turf/turf';
import { v4 as uuidv4 } from 'uuid';

export const createGeofenceTool: TAKTool = {
  name: 'tak_create_geofence',
  description: 'Create and manage geofenced areas with alert triggers',
  category: 'geospatial',
  requiresAuth: true,
  requiresWrite: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name for the geofence'
      },
      shape: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['circle', 'polygon', 'rectangle'],
            description: 'Type of geofence shape'
          },
          center: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: 'Center point [lat, lon] for circle or rectangle'
          },
          radius: {
            type: 'number',
            minimum: 0,
            description: 'Radius in meters (for circle)'
          },
          vertices: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2
            },
            minItems: 3,
            description: 'Polygon vertices [[lat, lon], ...] (for polygon)'
          },
          width: {
            type: 'number',
            minimum: 0,
            description: 'Width in meters (for rectangle)'
          },
          height: {
            type: 'number',
            minimum: 0,
            description: 'Height in meters (for rectangle)'
          }
        },
        required: ['type']
      },
      triggers: {
        type: 'object',
        properties: {
          onEntry: {
            type: 'boolean',
            default: true,
            description: 'Trigger alerts on entry'
          },
          onExit: {
            type: 'boolean',
            default: true,
            description: 'Trigger alerts on exit'
          },
          onDwell: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                default: false
              },
              duration: {
                type: 'number',
                minimum: 1,
                description: 'Dwell time in seconds before alert'
              }
            },
            description: 'Trigger alerts on dwelling inside'
          }
        }
      },
      monitorTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Entity types to monitor (e.g., ["a-h-*", "a-u-*"])'
      },
      alertLevel: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        description: 'Alert severity level'
      },
      active: {
        type: 'boolean',
        default: true,
        description: 'Whether the geofence is active'
      }
    },
    required: ['name', 'shape']
  },
  
  handler: async (context: ToolContext) => {
    const { takClient, params, logger } = context;
    
    try {
      // Generate unique ID for the geofence
      const geofenceId = `geofence-${uuidv4()}`;
      
      // Create the geofence geometry
      let geometry: any;
      let area: number = 0;
      let perimeter: number = 0;
      
      switch (params.shape.type) {
        case 'circle':
          if (!params.shape.center || !params.shape.radius) {
            throw new Error('Circle geofence requires center and radius');
          }
          const center = turf.point([params.shape.center[1], params.shape.center[0]]);
          geometry = turf.circle(center, params.shape.radius / 1000, { units: 'kilometers' });
          area = Math.PI * Math.pow(params.shape.radius, 2);
          perimeter = 2 * Math.PI * params.shape.radius;
          break;
          
        case 'polygon':
          if (!params.shape.vertices || params.shape.vertices.length < 3) {
            throw new Error('Polygon geofence requires at least 3 vertices');
          }
          const vertices = params.shape.vertices.map((v: number[]) => [v[1], v[0]]);
          vertices.push(vertices[0]); // Close the polygon
          geometry = turf.polygon([vertices]);
          area = turf.area(geometry);
          perimeter = turf.length(turf.polygonToLine(geometry), { units: 'meters' }) * 1000;
          break;
          
        case 'rectangle':
          if (!params.shape.center || !params.shape.width || !params.shape.height) {
            throw new Error('Rectangle geofence requires center, width, and height');
          }
          const rectCenter = turf.point([params.shape.center[1], params.shape.center[0]]);
          const bearing = 0; // North-aligned rectangle
          
          // Calculate rectangle corners
          const halfWidth = params.shape.width / 2;
          const halfHeight = params.shape.height / 2;
          
          const topLeft = turf.destination(
            turf.destination(rectCenter, halfHeight / 1000, bearing, { units: 'kilometers' }),
            halfWidth / 1000, bearing - 90, { units: 'kilometers' }
          );
          const topRight = turf.destination(
            turf.destination(rectCenter, halfHeight / 1000, bearing, { units: 'kilometers' }),
            halfWidth / 1000, bearing + 90, { units: 'kilometers' }
          );
          const bottomRight = turf.destination(
            turf.destination(rectCenter, halfHeight / 1000, bearing + 180, { units: 'kilometers' }),
            halfWidth / 1000, bearing + 90, { units: 'kilometers' }
          );
          const bottomLeft = turf.destination(
            turf.destination(rectCenter, halfHeight / 1000, bearing + 180, { units: 'kilometers' }),
            halfWidth / 1000, bearing - 90, { units: 'kilometers' }
          );
          
          geometry = turf.polygon([[
            topLeft.geometry.coordinates,
            topRight.geometry.coordinates,
            bottomRight.geometry.coordinates,
            bottomLeft.geometry.coordinates,
            topLeft.geometry.coordinates
          ]]);
          
          area = params.shape.width * params.shape.height;
          perimeter = 2 * (params.shape.width + params.shape.height);
          break;
          
        default:
          throw new Error(`Unknown geofence shape: ${params.shape.type}`);
      }
      
      // Create geofence object
      const geofence = {
        id: geofenceId,
        name: params.name,
        type: params.shape.type,
        geometry: geometry,
        triggers: params.triggers || { onEntry: true, onExit: true },
        monitorTypes: params.monitorTypes || ['a-*'], // Monitor all by default
        alertLevel: params.alertLevel || 'medium',
        active: params.active !== false,
        created: new Date().toISOString(),
        creator: 'tak-server-mcp',
        stats: {
          area: Math.round(area),
          perimeter: Math.round(perimeter),
          areaUnits: 'square meters',
          perimeterUnits: 'meters'
        }
      };
      
      // Send geofence as a CoT event
      const cotEvent = {
        type: 'u-d-f', // Drawing feature
        uid: geofenceId,
        time: new Date().toISOString(),
        start: new Date().toISOString(),
        stale: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        how: 'm-g', // Machine generated
        point: params.shape.center || turf.centroid(geometry).geometry.coordinates.reverse(),
        detail: {
          shape: geometry,
          fillColor: params.alertLevel === 'critical' ? 'FF0000' : 
                     params.alertLevel === 'high' ? 'FFA500' :
                     params.alertLevel === 'medium' ? 'FFFF00' : '00FF00',
          strokeColor: '000000',
          strokeWidth: 2,
          labels_on: params.name,
          remarks: `Geofence: ${params.name}`,
          contact: {
            callsign: params.name
          },
          usericon: {
            iconsetpath: '34ae1613-9645-4222-a9d2-e5f243dea2865/Military/Boundary.png'
          }
        }
      };
      
      await takClient.sendCotEvent({
        event: {
          _attributes: {
            version: '2.0',
            uid: geofenceId,
            type: cotEvent.type,
            time: cotEvent.time,
            start: cotEvent.start,
            stale: cotEvent.stale,
            how: cotEvent.how
          },
          point: {
            _attributes: {
              lat: cotEvent.point[0].toString(),
              lon: cotEvent.point[1].toString(),
              hae: '0',
              ce: '10',
              le: '10'
            }
          },
          detail: cotEvent.detail
        }
      });
      
      logger.info(`Created geofence: ${geofenceId}`);
      
      return {
        success: true,
        data: {
          geofence: geofence,
          message: `Geofence '${params.name}' created successfully`,
          cotUid: geofenceId
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'tak-server'
        }
      };
      
    } catch (error) {
      logger.error('Failed to create geofence:', error);
      
      return {
        success: false,
        error: {
          code: 'TAK_GEOFENCE_ERROR',
          message: 'Failed to create geofence',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};