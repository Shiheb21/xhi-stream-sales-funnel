# ═══════════════════════════════════════════════════════════════════════════
# Dockerfile — Lead Processor Service
# Multi-stage Docker build for a Turbo monorepo
# ═══════════════════════════════════════════════════════════════════════════

FROM node:20-alpine AS base
WORKDIR /app

# Install turbo globally
RUN npm install -g turbo

# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder
# ─────────────────────────────────────────────────────────────────────────────
# Prune the workspace for the lead-processor, removing extraneous apps/services
COPY . .
RUN turbo prune --scope="@xhi/lead-processor" --docker

# ─────────────────────────────────────────────────────────────────────────────
FROM base AS installer
# ─────────────────────────────────────────────────────────────────────────────
# Install dependencies
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Copy the actual sources and build
COPY --from=builder /app/out/full/ .
# Generate Prisma Client
RUN npm run db:generate
# Build the project
RUN turbo build --filter="@xhi/lead-processor"

# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner
# ─────────────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
USER fastify

# Copy built artifacts and modules
COPY --from=installer --chown=fastify:nodejs /app .

WORKDIR /app/services/lead-processor

CMD ["npm", "start"]
