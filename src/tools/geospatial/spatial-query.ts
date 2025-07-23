import { TAKTool, ToolContext } from '../registry';
import * as turf from '@turf/turf';
import mgrs from 'mgrs';
import * as h3 from 'h3-js';

export const spatialQueryTool: TAKTool = {
  name: 'tak_spatial_query',
  description: 'Query TAK entities within a geographic area using point-radius or polygon',
  category: 'geospatial',
  requiresAuth: true,
  requiresWrite: false,
  inputSchema: {
    type: 'object',
    properties: {
      center: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'Center point [lat, lon] for radius search'
      },
      radius: {
        type: 'number',
        minimum: 0,
        description: 'Search radius in meters (required if using center point)'
      },
      polygon: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2
        },
        minItems: 3,
        description: 'Polygon coordinates [[lat, lon], ...] for polygon search'
      },
      types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by entity types'
      },
      timeWindow: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' }
        },
        description: 'Time window for historical queries'
      },
      includeStale: {
        type: 'boolean',
        default: false,
        description: 'Include stale entities in results'
      }
    },
    oneOf: [
      { required: ['center', 'radius'] },
      { required: ['polygon'] }
    ]
  },
  async handler(context: ToolContext) {
    const { takClient, params, logger } = context;
    
    logger.info('Performing spatial query', { params });

    try {
      // Perform the spatial query
      const events = await takClient.spatialQuery({
        center: params.center,
        radius: params.radius,
        polygon: params.polygon,
        types: params.types,
        timeWindow: params.timeWindow ? {
          start: new Date(params.timeWindow.start),
          end: new Date(params.timeWindow.end)
        } : undefined
      });

      // Filter out stale events if requested
      const now = new Date();
      const filteredEvents = params.includeStale 
        ? events 
        : events.filter(event => new Date(event.stale) > now);

      // Calculate additional geospatial properties
      const enrichedResults = filteredEvents.map(event => {
        const point = turf.point([event.point.lon, event.point.lat]);
        let distanceFromCenter = null;
        let bearing = null;

        if (params.center && params.radius) {
          const centerPoint = turf.point([params.center[1], params.center[0]]);
          distanceFromCenter = turf.distance(centerPoint, point, { units: 'meters' });
          bearing = turf.bearing(centerPoint, point);
        }

        return {
          uid: event.uid,
          type: event.type,
          callsign: event.detail?.contact?.callsign,
          location: {
            lat: event.point.lat,
            lon: event.point.lon,
            alt: event.point.hae,
            mgrs: convertToMGRS(event.point.lat, event.point.lon), // Placeholder
            h3Index: getH3Index(event.point.lat, event.point.lon, 9) // Placeholder
          },
          time: event.time,
          stale: event.stale,
          distanceFromCenter,
          bearing,
          team: event.detail?.group?.name,
          role: event.detail?.group?.role,
          status: event.detail?.status
        };
      });

      // Group results by type
      const groupedByType = enrichedResults.reduce((acc, event) => {
        const type = event.type || 'unknown';
        if (!acc[type]) acc[type] = [];
        acc[type].push(event);
        return acc;
      }, {} as Record<string, any[]>);

      return {
        success: true,
        totalCount: enrichedResults.length,
        results: enrichedResults,
        summary: {
          byType: Object.entries(groupedByType).map(([type, items]) => ({
            type,
            count: items.length
          })),
          bounds: calculateBounds(enrichedResults),
          timeRange: {
            earliest: enrichedResults.reduce((min, e) => 
              new Date(e.time) < new Date(min) ? e.time : min, 
              enrichedResults[0]?.time
            ),
            latest: enrichedResults.reduce((max, e) => 
              new Date(e.time) > new Date(max) ? e.time : max, 
              enrichedResults[0]?.time
            )
          }
        }
      };
    } catch (error) {
      logger.error('Spatial query failed', error);
      throw error;
    }
  }
};

// Helper functions with real implementations
function convertToMGRS(lat: number, lon: number): string {
  try {
    return mgrs.forward([lon, lat]);
  } catch (error) {
    // Fallback if MGRS conversion fails
    return `${Math.abs(lat).toFixed(6)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(6)}${lon >= 0 ? 'E' : 'W'}`;
  }
}

function getH3Index(lat: number, lon: number, resolution: number): string {
  try {
    return h3.latLngToCell(lat, lon, resolution);
  } catch (error) {
    // Fallback if H3 conversion fails
    return `${lat.toFixed(2)}_${lon.toFixed(2)}_r${resolution}`;
  }
}

function calculateBounds(events: any[]): [number, number, number, number] | null {
  if (events.length === 0) return null;
  
  const lats = events.map(e => e.location.lat);
  const lons = events.map(e => e.location.lon);
  
  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats)
  ];
}