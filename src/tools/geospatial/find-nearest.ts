import { TAKTool, ToolContext } from '../registry';
import * as turf from '@turf/turf';

export const findNearestTool: TAKTool = {
  name: 'tak_find_nearest',
  description: 'Find nearest entities to a point or entity',
  category: 'geospatial',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      point: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: 'Entity ID to find nearest entities to'
          },
          coordinates: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: 'Coordinates [lat, lon] to find nearest entities to'
          }
        },
        description: 'Reference point (provide either entityId or coordinates)'
      },
      maxDistance: {
        type: 'number',
        minimum: 0,
        description: 'Maximum search distance in meters'
      },
      maxResults: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 10,
        description: 'Maximum number of results to return'
      },
      entityTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by entity types (e.g., ["a-f-*", "a-h-*"])'
      },
      excludeStale: {
        type: 'boolean',
        default: true,
        description: 'Exclude stale entities from results'
      },
      includeDetails: {
        type: 'boolean',
        default: true,
        description: 'Include full entity details in results'
      }
    },
    required: ['point']
  },
  
  handler: async (context: ToolContext) => {
    const { takClient, params, logger } = context;
    
    try {
      // Get reference coordinates
      let referenceCoords: number[];
      if (params.point.coordinates) {
        referenceCoords = params.point.coordinates;
      } else if (params.point.entityId) {
        const entities = await takClient.getEntities();
        const entity = entities.find(e => e.uid === params.point.entityId);
        if (!entity) {
          throw new Error(`Entity ${params.point.entityId} not found`);
        }
        referenceCoords = [entity.location.lat, entity.location.lon];
      } else {
        throw new Error('Either entityId or coordinates must be provided');
      }
      
      const referencePoint = turf.point([referenceCoords[1], referenceCoords[0]]); // turf uses [lon, lat]
      
      // Get all entities
      logger.debug('Fetching entities from TAK Server');
      const allEntities = await takClient.getEntities();
      
      // Filter entities
      let filteredEntities = allEntities;
      
      // Exclude the reference entity if entityId was provided
      if (params.point.entityId) {
        filteredEntities = filteredEntities.filter(e => e.uid !== params.point.entityId);
      }
      
      // Filter by entity types
      if (params.entityTypes && params.entityTypes.length > 0) {
        filteredEntities = filteredEntities.filter(entity => {
          return params.entityTypes.some((typePattern: any) => {
            if (typePattern.includes('*')) {
              const regex = new RegExp('^' + typePattern.replace('*', '.*') + '$');
              return regex.test(entity.type);
            }
            return entity.type === typePattern;
          });
        });
      }
      
      // Exclude stale entities
      if (params.excludeStale !== false) {
        filteredEntities = filteredEntities.filter(entity => {
          // Check if entity has lastUpdate field
          if (!entity.lastUpdate) return true;
          const lastUpdate = new Date(entity.lastUpdate);
          const now = new Date();
          const timeSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 1000;
          // Consider stale if not updated in last 5 minutes
          return timeSinceUpdate < 300;
        });
      }
      
      // Calculate distances
      const entitiesWithDistance = filteredEntities.map(entity => {
        const entityPoint = turf.point([entity.location.lon, entity.location.lat]);
        const distance = turf.distance(referencePoint, entityPoint, { units: 'meters' });
        const bearing = turf.bearing(referencePoint, entityPoint);
        
        return {
          entity: params.includeDetails !== false ? entity : {
            uid: entity.uid,
            type: entity.type,
            callsign: entity.callsign || entity.uid
          },
          distance: Math.round(distance),
          bearing: Math.round(bearing),
          compassDirection: getCompassDirection(bearing),
          location: {
            lat: entity.location.lat,
            lon: entity.location.lon,
            hae: entity.location.alt || 0
          }
        };
      });
      
      // Filter by max distance
      let results = entitiesWithDistance;
      if (params.maxDistance) {
        results = results.filter(item => item.distance <= params.maxDistance);
      }
      
      // Sort by distance and limit results
      results.sort((a, b) => a.distance - b.distance);
      results = results.slice(0, params.maxResults || 10);
      
      logger.info(`Found ${results.length} nearest entities`);
      
      // Calculate some statistics
      const stats = {
        totalEntities: allEntities.length,
        filteredEntities: filteredEntities.length,
        resultsReturned: results.length,
        nearestDistance: results[0]?.distance || null,
        farthestDistance: results[results.length - 1]?.distance || null,
        averageDistance: results.length > 0 
          ? Math.round(results.reduce((sum, r) => sum + r.distance, 0) / results.length)
          : null
      };
      
      return {
        success: true,
        data: {
          referencePoint: {
            entityId: params.point.entityId,
            coordinates: referenceCoords
          },
          nearestEntities: results,
          stats: stats
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'tak-server'
        }
      };
      
    } catch (error) {
      logger.error('Failed to find nearest entities:', error);
      
      return {
        success: false,
        error: {
          code: 'TAK_QUERY_ERROR',
          message: 'Failed to find nearest entities',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};

// Helper function to convert bearing to compass direction
function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((bearing + 360) % 360) / 22.5);
  return directions[index % 16];
}