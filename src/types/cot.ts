// Cursor on Target (CoT) type definitions

export interface CotEvent {
  uid: string;
  type: string;
  time: Date;
  start: Date;
  stale: Date;
  how: string;
  point: CotPoint;
  detail?: CotDetail;
  access?: string;
  qos?: string;
  opex?: string;
}

export interface CotPoint {
  lat: number;
  lon: number;
  hae: number;  // Height above ellipsoid
  ce: number;   // Circular error
  le: number;   // Linear error
}

export interface CotDetail {
  contact?: CotContact;
  status?: CotStatus;
  track?: CotTrack;
  precision_location?: CotPrecisionLocation;
  group?: CotGroup;
  takv?: CotTakv;
  // Additional detail fields can be added as needed
  [key: string]: any;
}

export interface CotContact {
  callsign?: string;
  endpoint?: string;
  iconsetpath?: string;
}

export interface CotStatus {
  battery?: number;
  readiness?: boolean;
}

export interface CotTrack {
  course?: number;
  speed?: number;
}

export interface CotPrecisionLocation {
  altsrc?: string;
  geopointsrc?: string;
}

export interface CotGroup {
  name?: string;
  role?: string;
}

export interface CotTakv {
  device?: string;
  platform?: string;
  os?: string;
  version?: string;
}

// CoT Message for sending
export interface CotMessage {
  event: {
    _attributes: {
      version: string;
      uid: string;
      type: string;
      time: string;
      start: string;
      stale: string;
      how: string;
    };
    point: {
      _attributes: {
        lat: string;
        lon: string;
        hae: string;
        ce: string;
        le: string;
      };
    };
    detail?: any;
  };
}

// Common CoT types
export const COT_TYPES = {
  // Friendly
  FRIENDLY_GROUND: 'a-f-G',
  FRIENDLY_AIR: 'a-f-A',
  FRIENDLY_SEA: 'a-f-S',
  
  // Hostile
  HOSTILE_GROUND: 'a-h-G',
  HOSTILE_AIR: 'a-h-A',
  HOSTILE_SEA: 'a-h-S',
  
  // Neutral
  NEUTRAL_GROUND: 'a-n-G',
  NEUTRAL_AIR: 'a-n-A',
  NEUTRAL_SEA: 'a-n-S',
  
  // Unknown
  UNKNOWN_GROUND: 'a-u-G',
  UNKNOWN_AIR: 'a-u-A',
  UNKNOWN_SEA: 'a-u-S',
  
  // Shapes
  SHAPE_LINE: 'u-d-f',
  SHAPE_POLYGON: 'u-d-f-a',
  SHAPE_CIRCLE: 'u-d-f-c',
  
  // Special
  EMERGENCY: 'b-a-o-tbl',
  GEOCHAT: 'b-t-f',
  SENSOR_POINT: 'b-m-p-s-p-i',
  ROUTE: 'b-m-r'
} as const;

export type CotType = typeof COT_TYPES[keyof typeof COT_TYPES];