import { TAKTool, ToolContext } from '../registry';
import * as turf from '@turf/turf';

export const calculateDistanceTool: TAKTool = {
  name: 'tak_calculate_distance',
  description: 'Calculate distances between entities, points, or coordinates',
  category: 'geospatial',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      from: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: 'Entity ID to calculate distance from'
          },
          coordinates: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: 'Coordinates [lat, lon] to calculate distance from'
          }
        },
        description: 'Starting point (provide either entityId or coordinates)'
      },
      to: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: 'Entity ID to calculate distance to'
          },
          coordinates: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: 'Coordinates [lat, lon] to calculate distance to'
          }
        },
        description: 'Destination point (provide either entityId or coordinates)'
      },
      units: {
        type: 'string',
        enum: ['meters', 'kilometers', 'miles', 'nauticalmiles'],
        default: 'meters',
        description: 'Units for distance measurement'
      },
      method: {
        type: 'string',
        enum: ['greatcircle', 'euclidean'],
        default: 'greatcircle',
        description: 'Calculation method'
      },
      batch: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entityId: { type: 'string' },
            coordinates: {
              type: 'array',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2
            }
          }
        },
        description: 'Calculate distances from "from" point to multiple destinations'
      }
    },
    oneOf: [
      {
        required: ['from', 'to']
      },
      {
        required: ['from', 'batch']
      }
    ]
  },
  
  handler: async (context: ToolContext) => {
    const { takClient, params, logger } = context;
    
    try {
      // Helper function to get coordinates
      const getCoordinates = async (point: { entityId?: string; coordinates?: number[] }) => {
        if (point.coordinates) {
          return point.coordinates;
        }
        if (point.entityId) {
          const entities = await takClient.getEntities();
          const entity = entities.find(e => e.uid === point.entityId);
          if (!entity) {
            throw new Error(`Entity ${point.entityId} not found`);
          }
          return [entity.location.lat, entity.location.lon];
        }
        throw new Error('Either entityId or coordinates must be provided');
      };
      
      // Get from coordinates
      const fromCoords = await getCoordinates(params.from);
      const fromPoint = turf.point([fromCoords[1], fromCoords[0]]); // turf uses [lon, lat]
      
      // Handle single distance calculation
      if (params.to) {
        const toCoords = await getCoordinates(params.to);
        const toPoint = turf.point([toCoords[1], toCoords[0]]);
        
        const distance = turf.distance(fromPoint, toPoint, { units: params.units || 'meters' });
        const bearing = turf.bearing(fromPoint, toPoint);
        
        // Calculate additional info
        const midpoint = turf.midpoint(fromPoint, toPoint);
        const travelTime = calculateTravelTime(distance, params.units || 'meters');
        
        return {
          success: true,
          data: {
            from: {
              entityId: params.from.entityId,
              coordinates: fromCoords
            },
            to: {
              entityId: params.to.entityId,
              coordinates: toCoords
            },
            distance: distance,
            units: params.units || 'meters',
            bearing: bearing,
            backBearing: (bearing + 180) % 360,
            midpoint: [midpoint.geometry.coordinates[1], midpoint.geometry.coordinates[0]],
            estimatedTravelTime: travelTime
          },
          metadata: {
            timestamp: new Date().toISOString(),
            calculationMethod: params.method || 'greatcircle'
          }
        };
      }
      
      // Handle batch distance calculations
      if (params.batch) {
        const results = await Promise.all(params.batch.map(async (destination: any) => {
          try {
            const toCoords = await getCoordinates(destination);
            const toPoint = turf.point([toCoords[1], toCoords[0]]);
            
            const distance = turf.distance(fromPoint, toPoint, { units: params.units || 'meters' });
            const bearing = turf.bearing(fromPoint, toPoint);
            
            return {
              to: {
                entityId: destination.entityId,
                coordinates: toCoords
              },
              distance: distance,
              bearing: bearing
            };
          } catch (error) {
            return {
              to: destination,
              error: error instanceof Error ? error.message : 'Failed to calculate distance'
            };
          }
        }));
        
        // Sort by distance
        const validResults = results.filter(r => !r.error);
        validResults.sort((a, b) => a.distance - b.distance);
        
        return {
          success: true,
          data: {
            from: {
              entityId: params.from.entityId,
              coordinates: fromCoords
            },
            distances: results,
            nearest: validResults[0],
            farthest: validResults[validResults.length - 1],
            units: params.units || 'meters'
          },
          metadata: {
            timestamp: new Date().toISOString(),
            calculationMethod: params.method || 'greatcircle',
            totalCalculations: params.batch.length,
            successfulCalculations: validResults.length
          }
        };
      }
      
    } catch (error) {
      logger.error('Failed to calculate distance:', error);
      
      return {
        success: false,
        error: {
          code: 'TAK_CALCULATION_ERROR',
          message: 'Failed to calculate distance',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};

// Helper function to estimate travel time based on distance
function calculateTravelTime(distance: number, units: string) {
  // Convert to meters if needed
  let distanceInMeters = distance;
  if (units === 'kilometers') distanceInMeters = distance * 1000;
  if (units === 'miles') distanceInMeters = distance * 1609.34;
  if (units === 'nauticalmiles') distanceInMeters = distance * 1852;
  
  return {
    walking: Math.round(distanceInMeters / 1.4 / 60), // 5 km/h
    vehicle: Math.round(distanceInMeters / 16.67 / 60), // 60 km/h
    helicopter: Math.round(distanceInMeters / 55.56 / 60), // 200 km/h
    units: 'minutes'
  };
}