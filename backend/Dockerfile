FROM node:18-alpine

WORKDIR /app

# Copy workspace package files
COPY package.json package-lock.json ./
COPY backend/package.json backend/

# Install dependencies
RUN npm install

# Copy source code
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/tsconfig.build.json ./
COPY backend/scripts ./scripts
COPY backend/sql ./sql

# Build
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 4000) + '/api/health', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })"

# Expose port
EXPOSE 4000

# Start
CMD ["npm", "run", "start"]
