# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S takuser && \
    adduser -S takuser -u 1001 -G takuser

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy any necessary files
COPY README.md ./
COPY LICENSE ./

# Set ownership
RUN chown -R takuser:takuser /app

# Switch to non-root user
USER takuser

# Expose port for HTTP/SSE transports
EXPOSE 3000

# Set default environment variables
ENV NODE_ENV=production \
    MCP_TRANSPORT=stdio \
    LOG_LEVEL=info

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/index.js"]