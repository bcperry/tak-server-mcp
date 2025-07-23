// TAK Server entity and resource types

export interface TAKEntity {
  uid: string;
  callsign: string;
  type: string;
  team: string;
  role: string;
  location: {
    lat: number;
    lon: number;
    alt?: number;
  };
  lastUpdate: Date;
  status: EntityStatus;
  attributes?: Record<string, any>;
}

export interface EntityStatus {
  online: boolean;
  battery?: number;
  speed?: number;
  course?: number;
  readiness?: string;
}

export interface Mission {
  name: string;
  description?: string;
  creatorUid: string;
  createTime: Date;
  keywords?: string[];
  baseLayer?: string;
  bbox?: [number, number, number, number];
  chatRoom?: string;
  tool?: string;
  passwordProtected: boolean;
  members?: MissionMember[];
  contents?: MissionContent[];
}

export interface MissionMember {
  uid: string;
  callsign: string;
  role: 'OWNER' | 'MEMBER' | 'READONLY';
  joinTime: Date;
}

export interface MissionContent {
  uid: string;
  type: 'ITEM' | 'PACKAGE' | 'RESOURCE';
  timestamp: Date;
  creatorUid: string;
  data?: any;
}

export interface DataPackage {
  id: string;
  name: string;
  description?: string;
  size: number;
  hash: string;
  createTime: Date;
  submissionTime: Date;
  submitter: string;
  creator?: string;
  type?: string;
  missionId?: string;
  keywords?: string[];
  mimeType?: string;
  tool?: string;
}

export interface ServerInfo {
  version: string;
  apiVersion: number;
  hostname: string;
  buildTime: Date;
  startTime: Date;
}

export interface Certificate {
  subjectDN: string;
  issuerDN: string;
  serialNumber: string;
  validFrom: Date;
  validUntil: Date;
  fingerprint: string;
}

export interface Group {
  name: string;
  description?: string;
  members: string[];
  created: Date;
  modified: Date;
}

export interface Subscription {
  uid: string;
  callsign: string;
  clientUid: string;
  protocol: string;
  address: string;
  port: number;
  filter?: string;
  xpath?: string;
}