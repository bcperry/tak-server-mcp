import { TAKTool, ToolContext } from '../registry';
import * as turf from '@turf/turf';

export const analyzeMovementTool: TAKTool = {
  name: 'tak_analyze_movement',
  description: 'Track and analyze entity movements, patterns, and anomalies',
  category: 'geospatial',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      entityId: {
        type: 'string',
        description: 'Entity ID to analyze movement for'
      },
      timeRange: {
        type: 'object',
        properties: {
          startTime: {
            type: 'string',
            description: 'ISO 8601 date string - start of analysis period'
          },
          endTime: {
            type: 'string',
            description: 'ISO 8601 date string - end of analysis period (defaults to now)'
          }
        },
        description: 'Time range for movement analysis'
      },
      analysisType: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['speed', 'pattern', 'anomaly', 'prediction', 'stops']
        },
        default: ['speed', 'pattern'],
        description: 'Types of analysis to perform'
      },
      anomalyThreshold: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        default: 0.8,
        description: 'Threshold for anomaly detection (0-1)'
      }
    },
    required: ['entityId']
  },
  
  handler: async (context: ToolContext) => {
    const { takClient, params, logger } = context;
    
    try {
      // Get CoT events for the entity within time range
      const endTime = params.timeRange?.endTime || new Date().toISOString();
      const startTime = params.timeRange?.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      logger.debug(`Fetching movement data for entity ${params.entityId}`);
      
      const events = await takClient.getCotEvents({
        uids: [params.entityId],
        start: new Date(startTime),
        end: new Date(endTime)
      });
      
      if (events.length < 2) {
        return {
          success: true,
          data: {
            entityId: params.entityId,
            message: 'Insufficient movement data for analysis',
            dataPoints: events.length
          },
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'tak-server'
          }
        };
      }
      
      // Sort events by time
      events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      // Extract positions and timestamps
      const positions = events.map(event => ({
        time: new Date(event.time),
        lat: event.point.lat,
        lon: event.point.lon,
        alt: event.point.hae || 0
      }));
      
      // Initialize analysis results
      const analysis: any = {
        entityId: params.entityId,
        timeRange: {
          start: startTime,
          end: endTime,
          duration: (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
        },
        dataPoints: positions.length
      };
      
      const analysisTypes = params.analysisType || ['speed', 'pattern'];
      
      // Speed analysis
      if (analysisTypes.includes('speed')) {
        const speeds: number[] = [];
        let totalDistance = 0;
        
        for (let i = 1; i < positions.length; i++) {
          const from = turf.point([positions[i-1].lon, positions[i-1].lat]);
          const to = turf.point([positions[i].lon, positions[i].lat]);
          const distance = turf.distance(from, to, { units: 'meters' });
          const timeDiff = (positions[i].time.getTime() - positions[i-1].time.getTime()) / 1000;
          
          if (timeDiff > 0) {
            const speed = (distance / timeDiff) * 3.6; // Convert to km/h
            speeds.push(speed);
            totalDistance += distance;
          }
        }
        
        analysis.speedAnalysis = {
          averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
          maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
          minSpeed: speeds.length > 0 ? Math.min(...speeds) : 0,
          totalDistance: totalDistance,
          units: {
            speed: 'km/h',
            distance: 'meters'
          }
        };
      }
      
      // Pattern analysis
      if (analysisTypes.includes('pattern')) {
        // Calculate heading changes
        const headings: number[] = [];
        for (let i = 1; i < positions.length; i++) {
          const from = turf.point([positions[i-1].lon, positions[i-1].lat]);
          const to = turf.point([positions[i].lon, positions[i].lat]);
          const bearing = turf.bearing(from, to);
          headings.push(bearing);
        }
        
        // Detect circular patterns
        const headingChanges = [];
        for (let i = 1; i < headings.length; i++) {
          let change = headings[i] - headings[i-1];
          if (change > 180) change -= 360;
          if (change < -180) change += 360;
          headingChanges.push(change);
        }
        
        const totalHeadingChange = headingChanges.reduce((a, b) => a + b, 0);
        const isCircular = Math.abs(totalHeadingChange) > 300; // Nearly full circle
        
        // Create movement path
        const coordinates = positions.map(p => [p.lon, p.lat]);
        const path = turf.lineString(coordinates);
        
        analysis.patternAnalysis = {
          movementType: isCircular ? 'circular' : 'linear',
          totalHeadingChange: totalHeadingChange,
          pathLength: turf.length(path, { units: 'meters' }) * 1000,
          boundingBox: turf.bbox(path)
        };
      }
      
      // Stop detection
      if (analysisTypes.includes('stops')) {
        const stops = [];
        const stopThreshold = 50; // meters
        const stopDuration = 300; // 5 minutes
        
        let currentStop: any = null;
        
        for (let i = 1; i < positions.length; i++) {
          const from = turf.point([positions[i-1].lon, positions[i-1].lat]);
          const to = turf.point([positions[i].lon, positions[i].lat]);
          const distance = turf.distance(from, to, { units: 'meters' });
          
          if (distance < stopThreshold) {
            if (!currentStop) {
              currentStop = {
                startTime: positions[i-1].time,
                location: positions[i-1],
                positions: [positions[i-1]]
              };
            }
            currentStop.positions.push(positions[i]);
            currentStop.endTime = positions[i].time;
          } else if (currentStop) {
            const duration = (currentStop.endTime.getTime() - currentStop.startTime.getTime()) / 1000;
            if (duration >= stopDuration) {
              stops.push({
                ...currentStop,
                duration: duration,
                center: turf.center(turf.points(currentStop.positions.map((p: any) => [p.lon, p.lat])))
              });
            }
            currentStop = null;
          }
        }
        
        analysis.stopAnalysis = {
          stops: stops,
          totalStops: stops.length,
          totalStopTime: stops.reduce((sum, stop) => sum + stop.duration, 0)
        };
      }
      
      // Anomaly detection
      if (analysisTypes.includes('anomaly')) {
        const anomalies = [];
        
        // Detect speed anomalies
        if (analysis.speedAnalysis) {
          const avgSpeed = analysis.speedAnalysis.averageSpeed;
          const speedThreshold = avgSpeed * (1 + params.anomalyThreshold);
          
          for (let i = 1; i < positions.length; i++) {
            const from = turf.point([positions[i-1].lon, positions[i-1].lat]);
            const to = turf.point([positions[i].lon, positions[i].lat]);
            const distance = turf.distance(from, to, { units: 'meters' });
            const timeDiff = (positions[i].time.getTime() - positions[i-1].time.getTime()) / 1000;
            
            if (timeDiff > 0) {
              const speed = (distance / timeDiff) * 3.6;
              if (speed > speedThreshold) {
                anomalies.push({
                  type: 'speed',
                  time: positions[i].time,
                  location: positions[i],
                  value: speed,
                  threshold: speedThreshold
                });
              }
            }
          }
        }
        
        analysis.anomalyAnalysis = {
          anomalies: anomalies,
          totalAnomalies: anomalies.length
        };
      }
      
      logger.info(`Movement analysis completed for entity ${params.entityId}`);
      
      return {
        success: true,
        data: analysis,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'tak-server'
        }
      };
      
    } catch (error) {
      logger.error('Failed to analyze movement:', error);
      
      return {
        success: false,
        error: {
          code: 'TAK_ANALYSIS_ERROR',
          message: 'Failed to analyze entity movement',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};