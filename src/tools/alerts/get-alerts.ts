import { TAKTool, ToolContext } from '../registry';

export const getAlertsTool: TAKTool = {
  name: 'tak_get_alerts',
  description: 'Retrieve and manage alerts from TAK Server',
  category: 'alerts',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      active: {
        type: 'boolean',
        description: 'Filter for only active alerts (true), inactive alerts (false), or all alerts (omit)'
      },
      severity: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical']
        },
        description: 'Filter by severity levels'
      },
      type: {
        type: 'string',
        description: 'Filter by alert type'
      },
      timeRange: {
        type: 'object',
        properties: {
          startTime: {
            type: 'string',
            description: 'ISO 8601 date string - alerts created after this time'
          },
          endTime: {
            type: 'string',
            description: 'ISO 8601 date string - alerts created before this time'
          }
        },
        description: 'Filter alerts by time range'
      }
    }
  },
  
  handler: async (context: ToolContext) => {
    const { takClient, params, logger } = context;
    
    try {
      // Get alerts from TAK Server
      logger.debug('Fetching alerts from TAK Server');
      const allAlerts = await takClient.getAlerts(params.active);
      
      // Apply additional filters
      let filteredAlerts = allAlerts;
      
      // Filter by severity
      if (params.severity && params.severity.length > 0) {
        filteredAlerts = filteredAlerts.filter(alert => 
          params.severity.includes(alert.severity)
        );
      }
      
      // Filter by type
      if (params.type) {
        filteredAlerts = filteredAlerts.filter(alert => 
          alert.type === params.type
        );
      }
      
      // Filter by time range
      if (params.timeRange) {
        if (params.timeRange.startTime) {
          const startTime = new Date(params.timeRange.startTime);
          filteredAlerts = filteredAlerts.filter(alert => 
            new Date(alert.timestamp || alert.created) >= startTime
          );
        }
        
        if (params.timeRange.endTime) {
          const endTime = new Date(params.timeRange.endTime);
          filteredAlerts = filteredAlerts.filter(alert => 
            new Date(alert.timestamp || alert.created) <= endTime
          );
        }
      }
      
      // Sort by timestamp (most recent first)
      filteredAlerts.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.created).getTime();
        const timeB = new Date(b.timestamp || b.created).getTime();
        return timeB - timeA;
      });
      
      logger.info(`Found ${filteredAlerts.length} alerts matching criteria`);
      
      // Calculate alert statistics
      const stats = {
        total: filteredAlerts.length,
        bySeverity: {
          critical: filteredAlerts.filter(a => a.severity === 'critical').length,
          high: filteredAlerts.filter(a => a.severity === 'high').length,
          medium: filteredAlerts.filter(a => a.severity === 'medium').length,
          low: filteredAlerts.filter(a => a.severity === 'low').length
        },
        active: filteredAlerts.filter(a => a.active || a.status === 'active').length,
        inactive: filteredAlerts.filter(a => !a.active && a.status !== 'active').length
      };
      
      return {
        success: true,
        data: {
          alerts: filteredAlerts,
          stats: stats
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'tak-server',
          totalAlerts: allAlerts.length
        }
      };
      
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      
      return {
        success: false,
        error: {
          code: 'TAK_CONNECTION_ERROR',
          message: 'Failed to retrieve alerts',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};