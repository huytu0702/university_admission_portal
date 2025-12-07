# ==============================================================================
# Stage 1: Build stage - Install all dependencies and compile TypeScript
# ==============================================================================
FROM node:18-alpine AS builder

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Copy Prisma schema for generating client
COPY prisma ./prisma/

# Install ALL dependencies (need devDependencies for building)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the NestJS application
RUN npm run build

# ==============================================================================
# Stage 2: Production dependencies - Clean install only production deps
# ==============================================================================
FROM node:18-alpine AS deps

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema (needed to generate client for production)
COPY prisma ./prisma/

# Install only production dependencies + prisma CLI for migrations
RUN npm ci --only=production && npm install prisma

# Generate Prisma client for production
RUN npx prisma generate

# ==============================================================================
# Stage 3: Production runtime - Minimal image for running the app
# ==============================================================================
FROM node:18-alpine AS runner

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache dumb-init

# Set production environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--experimental-global-webcrypto"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown nestjs:nodejs uploads

# Copy production dependencies from deps stage (with ownership)
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy Prisma generated client
COPY --from=deps --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema and migrations (needed for migrations in production)
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Copy compiled application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy package.json for npm scripts
COPY --chown=nestjs:nodejs package*.json ./

# Copy entrypoint script
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Use entrypoint script to run migrations before starting
CMD ["./docker-entrypoint.sh"]