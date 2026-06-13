# Production image for the GNE ERP app.
# Multi-stage: install deps -> build -> slim runtime. Migrations run on startup.

FROM node:22-bookworm-slim AS base
WORKDIR /app
# openssl + ca-certificates are needed by the Prisma engines and TLS (SMTP/DB).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ── Dependencies ──
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ──
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ── Runtime ──
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
# Bring over everything needed to run `next start` and `prisma migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
# Apply any pending DB migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
