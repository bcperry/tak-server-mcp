# FreeTAKServer Setup Guide

FreeTAKServer (FTS) is an open-source TAK Server implementation that provides both CoT messaging and a REST API, making it perfect for use with our TAK Server MCP.

## Quick Start with Docker

### Option 1: Docker Compose (Recommended)

1. **Use the docker-compose.yml file in this directory:**
   ```bash
   cd freetakserver-setup
   docker-compose up -d
   ```

2. **Check if it's running:**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

3. **Access FreeTAKServer:**
   - CoT Port: `8087` (TCP)
   - REST API: `http://localhost:19023`
   - WebUI: `http://localhost:5000`
   - Default credentials: `admin` / `password`

### Option 2: Standalone Docker

```bash
# Pull the latest image
docker pull freetakteam/freetakserver:latest

# Run FreeTAKServer
docker run -d \
  --name freetakserver \
  -p 8087:8087 \
  -p 8080:8080 \
  -p 19023:19023 \
  -p 5000:5000 \
  -v $(pwd)/fts-data:/opt/FTSData \
  freetakteam/freetakserver:latest
```

## FreeTAKServer Ports

- **8087**: CoT TCP Port (for TAK clients)
- **8080**: HTTP Port
- **19023**: REST API Port
- **5000**: Web UI Port

## REST API Endpoints

FreeTAKServer provides these REST API endpoints that our MCP can use:

### Authentication
```
POST /AuthenticateUser
GET /ManageSystemUser/getSystemUsers
```

### CoT Management
```
GET /ManageCoT/getLatestCoT
POST /ManageCoT/postCoT
GET /ManageCoT/getAllCoT
```

### Data Packages
```
GET /DataPackageTable/getDataPackages
POST /DataPackageTable/uploadDataPackage
DELETE /DataPackageTable/deleteDataPackage/{hash}
```

### Emergency Management
```
POST /ManageEmergency/postEmergency
GET /ManageEmergency/getEmergency
DELETE /ManageEmergency/deleteEmergency
```

### Geospatial
```
POST /ManageGeoObject/postGeoObject
GET /ManageGeoObject/getGeoObject
```

## Testing the Installation

1. **Check if REST API is working:**
   ```bash
   curl http://localhost:19023/
   ```

2. **Get system status:**
   ```bash
   curl http://localhost:19023/SystemStatus/getStatus
   ```

3. **Test CoT endpoint:**
   ```bash
   curl http://localhost:19023/ManageCoT/getLatestCoT
   ```

## Using with TAK Server MCP

1. **Update your MCP configuration:**
   ```json
   {
     "takServer": {
       "url": "http://localhost:19023",
       "cotPort": 8087,
       "type": "freetakserver"
     }
   }
   ```

2. **Run the MCP test:**
   ```bash
   cd ..
   ./test-freetakserver.js
   ```

## Troubleshooting

### Port Conflicts
If you already have services on these ports:
- Edit `docker-compose.yml` to change the port mappings
- Or stop conflicting services

### Connection Issues
- Check firewall settings
- Ensure Docker is running
- Check logs: `docker-compose logs freetakserver`

### API Authentication
FreeTAKServer uses bearer token authentication:
1. Get token: `POST /AuthenticateUser`
2. Use in headers: `Authorization: Bearer <token>`

## Production Considerations

For production use:
1. Change default passwords
2. Use HTTPS/TLS
3. Configure proper data persistence
4. Set up monitoring
5. Configure firewall rules

## Additional Resources

- [FreeTAKServer Docs](https://freetakteam.github.io/FreeTAKServer-User-Docs/)
- [API Documentation](https://freetakteam.github.io/FreeTAKServer-User-Docs/API/)
- [GitHub Repository](https://github.com/FreeTAKTeam/FreeTakServer)