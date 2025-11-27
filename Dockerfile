# syntax=docker/dockerfile:1.5

FROM oven/bun:1.1.29 AS builder
WORKDIR /usr/src/app
ENV NODE_ENV=development

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 build-essential \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY turbo.json ./
COPY apps/jwks-service ./apps/jwks-service
COPY packages/shared ./packages/shared

RUN bun install --frozen-lockfile \
	--filter=apps/jwks-service \
	--filter=packages/shared
RUN bun run --cwd packages/shared build
RUN bun run --cwd apps/jwks-service build

FROM oven/bun:1.1.29 AS prod-deps
WORKDIR /usr/src/app
ENV NODE_ENV=production

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 build-essential \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY apps/jwks-service/package.json ./apps/jwks-service/
COPY packages/shared/package.json ./packages/shared/
COPY --from=builder /usr/src/app/packages/shared/dist ./packages/shared/dist

RUN bun install --frozen-lockfile --production \
	--filter=apps/jwks-service \
	--filter=packages/shared

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
