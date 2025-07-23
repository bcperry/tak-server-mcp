import { TAKTool, ToolContext } from '../registry';
import { v4 as uuidv4 } from 'uuid';

export const sendEmergencyTool: TAKTool = {
  name: 'tak_send_emergency',
  description: 'Send emergency/911 alerts with priority handling',
  category: 'alerts',
  requiresAuth: true,
  requiresWrite: true,
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['911', 'panic', 'medical', 'fire', 'hostile', 'breakdown', 'custom'],
        description: 'Type of emergency'
      },
      message: {
        type: 'string',
        description: 'Emergency message or description'
      },
      location: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: 'Use location of existing entity'
          },
          coordinates: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: 'Specific coordinates [lat, lon]'
          }
        },
        description: 'Emergency location (provide either entityId or coordinates)'
      },
      callsign: {
        type: 'string',
        description: 'Callsign of entity in emergency'
      },
      severity: {
        type: 'string',
        enum: ['critical', 'high'],
        default: 'critical',
        description: 'Emergency severity (always high or critical)'
      },
      notifyRadius: {
        type: 'number',
        minimum: 0,
        default: 5000,
        description: 'Radius in meters to notify nearby units'
      }
    },
    required: ['type', 'message', 'location']
  },
  
  handler: async (context: ToolContext) => {
    const { takClient, params, logger } = context;
    
    try {
      // Get emergency location
      let emergencyLocation: [number, number];
      let entityInfo: any = {};
      
      if (params.location.coordinates) {
        emergencyLocation = params.location.coordinates;
      } else if (params.location.entityId) {
        const entities = await takClient.getEntities();
        const entity = entities.find(e => e.uid === params.location.entityId);
        if (!entity) {
          throw new Error(`Entity ${params.location.entityId} not found`);
        }
        emergencyLocation = [entity.location.lat, entity.location.lon];
        entityInfo = {
          callsign: entity.callsign,
          team: entity.team,
          role: entity.role
        };
      } else {
        throw new Error('Either entityId or coordinates must be provided');
      }
      
      const emergencyId = `emergency-${uuidv4()}`;
      const timestamp = new Date().toISOString();
      
      // Map emergency type to CoT type
      const cotTypeMap: Record<string, string> = {
        '911': 'b-a-o-tbl',
        'panic': 'b-a-o-pan',
        'medical': 'b-a-o-med',
        'fire': 'b-a-o-fir',
        'hostile': 'b-a-o-can',
        'breakdown': 'b-a-o-veh',
        'custom': 'b-a-o-oth'
      };
      
      const cotType = cotTypeMap[params.type] || 'b-a-o-oth';
      
      // Create emergency CoT event
      const emergencyEvent = {
        type: cotType,
        uid: emergencyId,
        time: timestamp,
        start: timestamp,
        stale: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
        how: 'm-g',
        point: {
          lat: emergencyLocation[0],
          lon: emergencyLocation[1],
          hae: 0,
          ce: 10,
          le: 10
        },
        detail: {
          emergency: {
            type: params.type,
            alert: true,
            cancel: false
          },
          contact: {
            callsign: params.callsign || entityInfo.callsign || 'EMERGENCY',
            phone: '911'
          },
          remarks: params.message,
          status: {
            text: params.message
          },
          usericon: {
            iconsetpath: 'COT_MAPPING_2525B/a-u/a-u-G'
          },
          color: {
            value: -65536 // Red
          }
        }
      };
      
      // Send the emergency CoT event
      await takClient.sendCotEvent({
        event: {
          _attributes: {
            version: '2.0',
            uid: emergencyId,
            type: emergencyEvent.type,
            time: emergencyEvent.time,
            start: emergencyEvent.start,
            stale: emergencyEvent.stale,
            how: emergencyEvent.how
          },
          point: {
            _attributes: {
              lat: emergencyEvent.point.lat.toString(),
              lon: emergencyEvent.point.lon.toString(),
              hae: emergencyEvent.point.hae.toString(),
              ce: emergencyEvent.point.ce.toString(),
              le: emergencyEvent.point.le.toString()
            }
          },
          detail: emergencyEvent.detail
        }
      });
      
      // Also send as an alert through the alert system
      await takClient.sendAlert({
        type: `emergency-${params.type}`,
        message: params.message,
        point: emergencyLocation,
        severity: params.severity as 'critical' | 'high'
      });
      
      // Find nearby units to notify
      const nearbyUnits = [];
      if (params.notifyRadius > 0) {
        const allEntities = await takClient.getEntities();
        
        for (const entity of allEntities) {
          // Calculate distance using simple Euclidean approximation
          const latDiff = entity.location.lat - emergencyLocation[0];
          const lonDiff = entity.location.lon - emergencyLocation[1];
          const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000; // Rough meters conversion
          
          if (distance <= params.notifyRadius && entity.uid !== params.location.entityId) {
            nearbyUnits.push({
              uid: entity.uid,
              callsign: entity.callsign,
              distance: Math.round(distance),
              team: entity.team
            });
          }
        }
        
        // Sort by distance
        nearbyUnits.sort((a, b) => a.distance - b.distance);
      }
      
      logger.warn(`EMERGENCY ALERT: ${params.type} - ${params.message} at ${emergencyLocation}`);
      
      return {
        success: true,
        data: {
          emergencyId: emergencyId,
          type: params.type,
          location: emergencyLocation,
          message: params.message,
          timestamp: timestamp,
          notifiedUnits: nearbyUnits.length,
          nearbyUnits: nearbyUnits.slice(0, 10), // First 10 nearest units
          cotUid: emergencyId
        },
        metadata: {
          timestamp: timestamp,
          source: 'tak-server',
          priority: 'emergency'
        }
      };
      
    } catch (error) {
      logger.error('Failed to send emergency alert:', error);
      
      return {
        success: false,
        error: {
          code: 'TAK_EMERGENCY_ERROR',
          message: 'Failed to send emergency alert',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};