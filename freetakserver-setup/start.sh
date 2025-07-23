#!/bin/bash

echo "🚀 Starting FreeTAKServer with Docker Compose..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p fts-data

# Start FreeTAKServer
echo "📦 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for FreeTAKServer to start..."
sleep 10

# Check if services are running
echo ""
echo "🔍 Checking service status..."
docker-compose ps

# Test the API
echo ""
echo "🧪 Testing FreeTAKServer API..."
curl -s http://localhost:19023/SystemStatus/getStatus | jq . 2>/dev/null || echo "API not ready yet..."

echo ""
echo "✅ FreeTAKServer should now be running!"
echo ""
echo "📍 Access points:"
echo "   - REST API: http://localhost:19023"
echo "   - Web UI: http://localhost:5000"
echo "   - CoT Port: 8087 (TCP)"
echo ""
echo "📋 Useful commands:"
echo "   - View logs: docker-compose logs -f"
echo "   - Stop services: docker-compose down"
echo "   - Restart services: docker-compose restart"
echo ""
echo "🧪 To test with MCP:"
echo "   cd .."
echo "   ./test-freetakserver.js"