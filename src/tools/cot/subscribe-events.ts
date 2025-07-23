import { TAKTool, ToolContext } from '../registry';

export const subscribeEventsTool: TAKTool = {
  name: 'tak_subscribe_events',
  description: 'Subscribe to real-time CoT event streams with filtering',
  category: 'cot',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by CoT event types (e.g., ["a-h-*", "b-a-o-tbl"])'
      },
      area: {
        type: 'object',
        properties: {
          center: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: 'Center point [lat, lon] for area filter'
          },
          radius: {
            type: 'number',
            minimum: 0,
            description: 'Radius in meters for area filter'
          }
        },
        description: 'Geographic area filter'
      },
      callsigns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by specific callsigns'
      },
      duration: {
        type: 'number',
        minimum: 1,
        maximum: 3600,
        default: 300,
        description: 'Subscription duration in seconds (max 1 hour)'
      }
    }
  },
  
  handler: async (context: ToolContext) => {
    const { takClient, params, logger } = context;
    
    try {
      logger.info('Setting up CoT event subscription');
      
      // Create subscription filter
      const filter: any = {};
      
      if (params.types && params.types.length > 0) {
        filter.types = params.types;
      }
      
      if (params.callsigns && params.callsigns.length > 0) {
        filter.callsigns = params.callsigns;
      }
      
      if (params.area) {
        filter.area = params.area;
      }
      
      // Track received events
      const events: any[] = [];
      let eventCount = 0;
      
      // Set up subscription with callback
      await takClient.subscribeToCotEvents(
        filter,
        (event) => {
          eventCount++;
          logger.debug(`Received CoT event: ${event.type} from ${event.detail?.contact?.callsign || 'Unknown'}`);
          
          // Add event to buffer (limit to last 100 events)
          events.push({
            ...event,
            receivedAt: new Date().toISOString()
          });
          
          if (events.length > 100) {
            events.shift();
          }
        }
      );
      
      // Set up automatic unsubscribe after duration
      const duration = params.duration || 300;
      setTimeout(async () => {
        try {
          await takClient.unsubscribe();
          logger.info(`Subscription ended after ${duration} seconds`);
        } catch (error) {
          logger.error('Error unsubscribing:', error);
        }
      }, duration * 1000);
      
      return {
        success: true,
        data: {
          subscriptionId: 'active',
          status: 'subscribed',
          filter: filter,
          duration: duration,
          message: `Subscribed to CoT events for ${duration} seconds. Events will be delivered in real-time.`,
          initialEvents: events.slice(0, 10) // Return first 10 events if any
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'tak-server'
        }
      };
      
    } catch (error) {
      logger.error('Failed to subscribe to events:', error);
      
      return {
        success: false,
        error: {
          code: 'TAK_SUBSCRIPTION_ERROR',
          message: 'Failed to subscribe to CoT events',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};