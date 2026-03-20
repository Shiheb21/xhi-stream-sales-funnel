# ═══════════════════════════════════════════════════════════════════════════
# Dockerfile — API Gateway Service
# Multi-stage Docker build for a Turbo monorepo
# ═══════════════════════════════════════════════════════════════════════════

FROM node:20-alpine AS base
WORKDIR /app

RUN npm install -g turbo

# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder
# ─────────────────────────────────────────────────────────────────────────────
COPY . .
RUN turbo prune --scope="@xhi/api-gateway" --docker

# ─────────────────────────────────────────────────────────────────────────────
FROM base AS installer
# ─────────────────────────────────────────────────────────────────────────────
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci

COPY --from=builder /app/out/full/ .
# Note: we might need db generated for API later, skipped for placeholder
RUN turbo build --filter="@xhi/api-gateway"

# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner
# ─────────────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
USER fastify

COPY --from=installer --chown=fastify:nodejs /app .

WORKDIR /app/apps/api

CMD ["npm", "start"]
