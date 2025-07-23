import { TAKTool, ToolContext } from '../registry';

export const getEntitiesTool: TAKTool = {
  name: 'tak_get_entities',
  description: 'Get current TAK entities (units, markers, etc.) with optional filtering',
  category: 'entities',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by entity types (e.g., ["a-f-*", "a-h-*"])'
      },
      teams: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by team names'
      },
      roles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by roles'
      },
      bbox: {
        type: 'array',
        items: { type: 'number' },
        minItems: 4,
        maxItems: 4,
        description: 'Bounding box [minLon, minLat, maxLon, maxLat]'
      },
      includeStale: {
        type: 'boolean',
        default: false,
        description: 'Include entities with stale data'
      }
    }
  },
  async handler(context: ToolContext) {
    const { takClient, params, logger } = context;
    
    logger.info('Retrieving TAK entities', { params });

    try {
      // Get entities using the TAK Server client
      const entities = await takClient.getEntities({
        types: params.types,
        teams: params.teams,
        roles: params.roles,
        bbox: params.bbox
      });

      // Filter out stale entities if requested
      const now = new Date();
      const activeEntities = params.includeStale 
        ? entities 
        : entities.filter(entity => {
            // Check if entity has lastUpdate and it's recent (within 5 minutes)
            if (entity.lastUpdate) {
              const lastUpdate = new Date(entity.lastUpdate);
              const ageMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;
              return ageMinutes < 5;
            }
            return true;
          });

      // Group entities by type for summary
      const byType = activeEntities.reduce((acc, entity) => {
        const typePrefix = entity.type.split('-').slice(0, 3).join('-');
        if (!acc[typePrefix]) {
          acc[typePrefix] = [];
        }
        acc[typePrefix].push(entity);
        return acc;
      }, {} as Record<string, any[]>);

      // Group by team
      const byTeam = activeEntities.reduce((acc, entity) => {
        const team = entity.team || 'Unknown';
        if (!acc[team]) {
          acc[team] = [];
        }
        acc[team].push(entity);
        return acc;
      }, {} as Record<string, any[]>);

      logger.info(`Retrieved ${activeEntities.length} active entities`);

      return {
        success: true,
        totalCount: activeEntities.length,
        entities: activeEntities.map(entity => ({
          uid: entity.uid,
          callsign: entity.callsign,
          type: entity.type,
          team: entity.team,
          role: entity.role,
          location: entity.location,
          status: entity.status,
          lastUpdate: entity.lastUpdate
        })),
        summary: {
          byType: Object.entries(byType).map(([type, items]) => ({
            type,
            count: items.length,
            description: getTypeDescription(type)
          })),
          byTeam: Object.entries(byTeam).map(([team, items]) => ({
            team,
            count: items.length
          })),
          statusBreakdown: {
            online: activeEntities.filter(e => e.status?.online).length,
            offline: activeEntities.filter(e => !e.status?.online).length
          }
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve entities', error);
      throw error;
    }
  }
};

function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'a-f-G': 'Friendly Ground',
    'a-f-A': 'Friendly Air',
    'a-f-S': 'Friendly Sea',
    'a-h-G': 'Hostile Ground',
    'a-h-A': 'Hostile Air',
    'a-h-S': 'Hostile Sea',
    'a-n-G': 'Neutral Ground',
    'a-n-A': 'Neutral Air',
    'a-n-S': 'Neutral Sea',
    'a-u-G': 'Unknown Ground',
    'a-u-A': 'Unknown Air',
    'a-u-S': 'Unknown Sea',
    'b-a-o': 'Emergency/Alert',
    'b-m-p': 'Sensor Point',
    'u-d-f': 'Shape/Drawing'
  };
  
  return descriptions[type] || type;
}