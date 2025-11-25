# syntax=docker/dockerfile:1.5

FROM oven/bun:1.1.29 AS builder
WORKDIR /usr/src/app
ENV NODE_ENV=development

COPY package.json bun.lock ./
COPY turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN bun install --frozen-lockfile
RUN bun --cwd packages/shared run build
RUN bun --cwd apps/jwks-service run build

FROM oven/bun:1.1.29 AS prod-deps
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY apps/jwks-service/package.json ./apps/jwks-service/
COPY packages/shared/package.json ./packages/shared/
COPY --from=builder /usr/src/app/packages/shared/dist ./packages/shared/dist

RUN bun install --frozen-lockfile --production

FROM node:20-slim AS runner
WORKDIR /usr/src/app/apps/jwks-service
ENV NODE_ENV=production

COPY --from=prod-deps /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=prod-deps /usr/src/app/package.json /usr/src/app/
COPY --from=prod-deps /usr/src/app/apps/jwks-service/package.json ./
COPY --from=prod-deps /usr/src/app/packages/shared /usr/src/app/packages/shared
COPY --from=builder /usr/src/app/apps/jwks-service/dist ./dist

EXPOSE 3100
CMD ["node", "dist/server.mjs"]
