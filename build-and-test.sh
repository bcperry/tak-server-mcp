#!/bin/bash

# TAK Server MCP Build and Test Script

echo "🔨 Building TAK Server MCP..."

# Clean previous build
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🏗️ Building TypeScript..."
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Run basic test
echo "🧪 Running basic MCP test..."
npm run test:mcp

echo "🎉 Build and test complete!"