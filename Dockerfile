# syntax=docker/dockerfile:1.5

FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock* .npmrc ./


RUN --mount=type=secret,id=npm_token,required=true \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:1-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock* .npmrc ./


RUN --mount=type=secret,id=npm_token,required=true \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist

EXPOSE 3100

CMD ["bun", "run", "dist/server.mjs"]
