#!/bin/bash

# Docker-based testing script for TAK Server MCP

echo "🐳 Testing TAK Server MCP with Docker..."

# Build the Docker image
echo "Building Docker image..."
docker build -t tak-server-mcp-test .

# Test 1: List available tools
echo -e "\n📋 Test 1: Listing available tools"
docker run --rm \
  -e TAK_SERVER_URL=https://tak.example.com \
  -e TAK_SERVER_API_TOKEN=test-token \
  tak-server-mcp-test \
  node dist/index.js --list-tools

# Test 2: Get missions
echo -e "\n📋 Test 2: Get missions"
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tak_get_missions","arguments":{}}}' | \
docker run -i --rm \
  -e TAK_SERVER_URL=https://tak.example.com \
  -e TAK_SERVER_API_TOKEN=test-token \
  tak-server-mcp-test

# Test 3: Calculate distance
echo -e "\n📋 Test 3: Calculate distance"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"tak_calculate_distance","arguments":{"from":{"coordinates":[37.7749,-122.4194]},"to":{"coordinates":[37.7849,-122.4094]},"units":"kilometers"}}}' | \
docker run -i --rm \
  -e TAK_SERVER_URL=https://tak.example.com \
  -e TAK_SERVER_API_TOKEN=test-token \
  tak-server-mcp-test

echo -e "\n✅ Docker tests completed!"