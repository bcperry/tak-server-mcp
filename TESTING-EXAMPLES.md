# TAK Server MCP - Testing Examples

## Prerequisites
1. Build the project: `npm run build`
2. Set environment variables:
   ```bash
   export TAK_SERVER_URL=https://your-tak-server.com
   export TAK_SERVER_API_TOKEN=your-api-token
   ```

## Tool Testing Examples

### 1. tak_get_missions - Mission Management
```json
// List all missions
{
  "name": "tak_get_missions",
  "arguments": {}
}

// Filter missions by creator and date
{
  "name": "tak_get_missions",
  "arguments": {
    "creator": "admin",
    "createdAfter": "2024-01-01T00:00:00Z",
    "keywords": "training"
  }
}
```

### 2. tak_get_alerts - Alert Management
```json
// Get all active high-priority alerts
{
  "name": "tak_get_alerts",
  "arguments": {
    "active": true,
    "severity": ["high", "critical"],
    "timeRange": {
      "startTime": "2024-01-20T00:00:00Z"
    }
  }
}
```

### 3. tak_calculate_distance - Distance Calculations
```json
// Calculate distance between two coordinates
{
  "name": "tak_calculate_distance",
  "arguments": {
    "from": {
      "coordinates": [37.7749, -122.4194]
    },
    "to": {
      "coordinates": [37.7849, -122.4094]
    },
    "units": "kilometers"
  }
}

// Batch distance calculation from entity to multiple points
{
  "name": "tak_calculate_distance",
  "arguments": {
    "from": {
      "entityId": "UNIT-001"
    },
    "batch": [
      {"coordinates": [37.7749, -122.4194]},
      {"coordinates": [37.7849, -122.4094]},
      {"entityId": "UNIT-002"}
    ],
    "units": "meters"
  }
}
```

### 4. tak_find_nearest - Proximity Search
```json
// Find 5 nearest friendly units within 5km
{
  "name": "tak_find_nearest",
  "arguments": {
    "point": {
      "coordinates": [37.7749, -122.4194]
    },
    "maxDistance": 5000,
    "maxResults": 5,
    "entityTypes": ["a-f-*"],
    "excludeStale": true
  }
}

// Find nearest entities to a specific unit
{
  "name": "tak_find_nearest",
  "arguments": {
    "point": {
      "entityId": "UNIT-001"
    },
    "maxResults": 10
  }
}
```

### 5. tak_subscribe_events - Real-time Monitoring
```json
// Subscribe to all hostile force events for 5 minutes
{
  "name": "tak_subscribe_events",
  "arguments": {
    "types": ["a-h-*", "b-a-o-tbl"],
    "duration": 300,
    "area": {
      "center": [37.7749, -122.4194],
      "radius": 10000
    }
  }
}
```

### 6. tak_create_geofence - Geofencing
```json
// Create circular security zone
{
  "name": "tak_create_geofence",
  "arguments": {
    "name": "Base Perimeter",
    "shape": {
      "type": "circle",
      "center": [37.7749, -122.4194],
      "radius": 2000
    },
    "triggers": {
      "onEntry": true,
      "onExit": true,
      "onDwell": {
        "enabled": true,
        "duration": 600
      }
    },
    "monitorTypes": ["a-h-*", "a-u-*"],
    "alertLevel": "high"
  }
}

// Create rectangular no-fly zone
{
  "name": "tak_create_geofence",
  "arguments": {
    "name": "No-Fly Zone Alpha",
    "shape": {
      "type": "rectangle",
      "center": [37.7749, -122.4194],
      "width": 5000,
      "height": 3000
    },
    "monitorTypes": ["a-f-A-*"],
    "alertLevel": "critical"
  }
}
```

### 7. tak_analyze_movement - Movement Analysis
```json
// Analyze entity movement for last 24 hours
{
  "name": "tak_analyze_movement",
  "arguments": {
    "entityId": "UNIT-001",
    "timeRange": {
      "startTime": "2024-01-20T00:00:00Z"
    },
    "analysisType": ["speed", "pattern", "stops", "anomaly"],
    "anomalyThreshold": 0.7
  }
}
```

### 8. tak_send_emergency - Emergency Alerts
```json
// Send medical emergency alert
{
  "name": "tak_send_emergency",
  "arguments": {
    "type": "medical",
    "message": "Soldier down, immediate medical assistance required",
    "location": {
      "entityId": "UNIT-001"
    },
    "callsign": "ALPHA-1",
    "severity": "critical",
    "notifyRadius": 5000
  }
}

// Send hostile contact alert
{
  "name": "tak_send_emergency",
  "arguments": {
    "type": "hostile",
    "message": "Contact with enemy forces, requesting immediate support",
    "location": {
      "coordinates": [37.7749, -122.4194]
    },
    "severity": "critical",
    "notifyRadius": 10000
  }
}
```

### 9. tak_manage_data_packages - File Management
```json
// List all data packages
{
  "name": "tak_manage_data_packages",
  "arguments": {
    "operation": "list",
    "filter": {
      "type": "mission",
      "createdAfter": "2024-01-01T00:00:00Z"
    }
  }
}

// Upload a new map package
{
  "name": "tak_manage_data_packages",
  "arguments": {
    "operation": "upload",
    "uploadData": {
      "name": "Area_Map_Alpha.zip",
      "description": "Tactical map of operational area Alpha",
      "type": "map",
      "missionId": "MISSION-001",
      "fileData": "base64_encoded_file_content_here"
    }
  }
}

// Download a package
{
  "name": "tak_manage_data_packages",
  "arguments": {
    "operation": "download",
    "packageId": "pkg-12345"
  }
}
```

### 10. tak_spatial_query - Area Queries
```json
// Query all entities within 10km radius
{
  "name": "tak_spatial_query",
  "arguments": {
    "center": [37.7749, -122.4194],
    "radius": 10000,
    "types": ["a-*"],
    "includeH3": true,
    "h3Resolution": 9
  }
}

// Query entities within polygon area
{
  "name": "tak_spatial_query",
  "arguments": {
    "polygon": [
      [37.7749, -122.4194],
      [37.7849, -122.4194],
      [37.7849, -122.4094],
      [37.7749, -122.4094]
    ],
    "types": ["a-f-*", "a-h-*"]
  }
}
```

### 11. tak_get_cot_events - Event History
```json
// Get all events from last hour
{
  "name": "tak_get_cot_events",
  "arguments": {
    "startTime": "2024-01-22T12:00:00Z",
    "endTime": "2024-01-22T13:00:00Z",
    "types": ["a-*", "b-*"],
    "limit": 100
  }
}

// Get events for specific entities
{
  "name": "tak_get_cot_events",
  "arguments": {
    "uids": ["UNIT-001", "UNIT-002"],
    "startTime": "2024-01-22T00:00:00Z"
  }
}
```

### 12. tak_send_cot_event - Send Custom Events
```json
// Send a custom position update
{
  "name": "tak_send_cot_event",
  "arguments": {
    "event": {
      "_attributes": {
        "version": "2.0",
        "uid": "CUSTOM-001",
        "type": "a-f-G-U-C",
        "time": "2024-01-22T12:00:00Z",
        "start": "2024-01-22T12:00:00Z",
        "stale": "2024-01-22T13:00:00Z",
        "how": "m-g"
      },
      "point": {
        "_attributes": {
          "lat": "37.7749",
          "lon": "-122.4194",
          "hae": "100",
          "ce": "10",
          "le": "10"
        }
      },
      "detail": {
        "contact": {
          "_attributes": {
            "callsign": "CUSTOM-UNIT"
          }
        }
      }
    }
  }
}
```

### 13. tak_get_entities - Entity Status
```json
// Get all friendly ground units
{
  "name": "tak_get_entities",
  "arguments": {
    "types": ["a-f-G-*"],
    "excludeStale": true
  }
}

// Get entities in specific area
{
  "name": "tak_get_entities",
  "arguments": {
    "bbox": [-122.5, 37.7, -122.3, 37.8],
    "teams": ["Blue", "Red"]
  }
}
```

## Quick Test Script

Run all tests with the provided script:
```bash
# Make executable
chmod +x test-all-tools.js

# Run all tests automatically
./test-all-tools.js --all

# Or run in interactive mode
./test-all-tools.js
```

## Testing with Different Transports

### stdio (for Claude Desktop)
```bash
MCP_TRANSPORT=stdio npm start
```

### HTTP
```bash
MCP_TRANSPORT=http MCP_PORT=3000 npm start
# Then POST to http://localhost:3000/rpc
```

### SSE (Server-Sent Events)
```bash
MCP_TRANSPORT=sse MCP_PORT=3000 npm start
# Connect to http://localhost:3000/sse
```