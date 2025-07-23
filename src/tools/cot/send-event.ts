import { TAKTool, ToolContext } from '../registry';
import { v4 as uuidv4 } from 'uuid';
import { CotMessage } from '../../types/cot';

export const sendCotEventTool: TAKTool = {
  name: 'tak_send_cot_event',
  description: 'Send a Cursor on Target (CoT) event to TAK Server',
  category: 'cot',
  requiresAuth: true,
  requiresWrite: true,
  inputSchema: {
    type: 'object',
    properties: {
      uid: {
        type: 'string',
        description: 'Unique identifier for the event (auto-generated if not provided)'
      },
      type: {
        type: 'string',
        description: 'CoT type (e.g., "a-f-G-U-C" for friendly ground unit)',
        default: 'a-f-G-U-C'
      },
      callsign: {
        type: 'string',
        description: 'Callsign for the entity',
        default: 'MCP-EVENT'
      },
      location: {
        type: 'object',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 },
          alt: { type: 'number', description: 'Altitude in meters HAE' }
        },
        required: ['lat', 'lon']
      },
      how: {
        type: 'string',
        description: 'How the position was determined',
        enum: ['m-g', 'h-e', 'm-p', 'm-s'],
        default: 'm-g'
      },
      staleMinutes: {
        type: 'number',
        description: 'Minutes until the event becomes stale',
        default: 5,
        minimum: 1
      },
      detail: {
        type: 'object',
        description: 'Additional event details',
        additionalProperties: true
      }
    },
    required: ['location']
  },
  async handler(context: ToolContext) {
    const { takClient, params, logger } = context;
    
    logger.info('Sending CoT event', { params });

    try {
      const now = new Date();
      const staleTime = new Date(now.getTime() + (params.staleMinutes || 5) * 60000);
      
      // Build CoT message
      const cotMessage: CotMessage = {
        event: {
          _attributes: {
            version: '2.0',
            uid: params.uid || uuidv4(),
            type: params.type || 'a-f-G-U-C',
            time: now.toISOString(),
            start: now.toISOString(),
            stale: staleTime.toISOString(),
            how: params.how || 'm-g'
          },
          point: {
            _attributes: {
              lat: params.location.lat.toString(),
              lon: params.location.lon.toString(),
              hae: (params.location.alt || 0).toString(),
              ce: '999999',
              le: '999999'
            }
          },
          detail: {
            contact: {
              _attributes: {
                callsign: params.callsign || 'MCP-EVENT'
              }
            },
            ...params.detail
          }
        }
      };

      await takClient.sendCotEvent(cotMessage);

      logger.info('CoT event sent successfully', { uid: cotMessage.event._attributes.uid });

      return {
        success: true,
        uid: cotMessage.event._attributes.uid,
        message: 'CoT event sent successfully',
        event: {
          uid: cotMessage.event._attributes.uid,
          type: cotMessage.event._attributes.type,
          callsign: params.callsign || 'MCP-EVENT',
          location: params.location,
          time: now.toISOString(),
          stale: staleTime.toISOString()
        }
      };
    } catch (error) {
      logger.error('Failed to send CoT event', error);
      throw error;
    }
  }
};