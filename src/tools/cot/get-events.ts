import { TAKTool, ToolContext } from '../registry';

export const getCotEventsTool: TAKTool = {
  name: 'tak_get_cot_events',
  description: 'Retrieve Cursor on Target (CoT) events from TAK Server with optional filtering',
  category: 'cot',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      start: {
        type: 'string',
        format: 'date-time',
        description: 'Start time for event query (ISO 8601)'
      },
      end: {
        type: 'string',
        format: 'date-time',
        description: 'End time for event query (ISO 8601)'
      },
      types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by CoT types (e.g., ["a-f-G", "a-h-A"])'
      },
      uids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by specific UIDs'
      },
      bbox: {
        type: 'array',
        items: { type: 'number' },
        minItems: 4,
        maxItems: 4,
        description: 'Bounding box [minLon, minLat, maxLon, maxLat]'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 1000,
        default: 100,
        description: 'Maximum number of events to return'
      }
    }
  },
  async handler(context: ToolContext) {
    const { takClient, params, logger } = context;
    
    logger.info('Retrieving CoT events', { params });

    try {
      const events = await takClient.getCotEvents({
        start: params.start ? new Date(params.start) : undefined,
        end: params.end ? new Date(params.end) : undefined,
        types: params.types,
        uids: params.uids,
        bbox: params.bbox,
        limit: params.limit
      });

      logger.info(`Retrieved ${events.length} CoT events`);

      return {
        success: true,
        count: events.length,
        events: events.map(event => ({
          uid: event.uid,
          type: event.type,
          callsign: event.detail?.contact?.callsign,
          time: event.time,
          stale: event.stale,
          location: {
            lat: event.point.lat,
            lon: event.point.lon,
            alt: event.point.hae
          },
          how: event.how,
          detail: event.detail
        }))
      };
    } catch (error) {
      logger.error('Failed to retrieve CoT events', error);
      throw error;
    }
  }
};