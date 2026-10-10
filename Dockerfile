# syntax=docker/dockerfile:1.7
# Multi-arch (amd64 + arm64/Oracle Ampere). Targets: web, sites, worker, migrate.

FROM node:22.20.0-alpine3.22 AS base
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

# Fetch dependencies from the lockfile only, so this layer is cached across code changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch

FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --offline --frozen-lockfile
# Public Stripe key is inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ENV NODE_ENV=production NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RUN pnpm turbo run build --filter=@zfunnel/web --filter=@zfunnel/sites

FROM node:22.20.0-alpine3.22 AS runtime
RUN apk add --no-cache libc6-compat && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0

FROM runtime AS web
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
USER app
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/sign-in').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

FROM runtime AS sites
COPY --from=build --chown=app:app /repo/apps/sites/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/sites/.next/static ./apps/sites/.next/static
USER app
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3001/api/tls/ask').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/sites/server.js"]

# Worker and migrations: copy only each package and its production dependencies.
FROM build AS pruned
RUN pnpm deploy --legacy --filter @zfunnel/worker --prod /out/worker \
 && pnpm deploy --legacy --filter @zfunnel/db /out/db

FROM runtime AS worker
COPY --from=pruned --chown=app:app /out/worker ./
USER app
CMD ["node_modules/.bin/tsx", "src/index.ts"]

FROM runtime AS migrate
COPY --from=pruned --chown=app:app /out/db ./
USER app
CMD ["node_modules/.bin/tsx", "src/migrate.ts"]
