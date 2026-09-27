# syntax=docker/dockerfile:1.5

FROM oven/bun:1.3.5-alpine AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY vendor/eslint-config ./vendor/eslint-config

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:1.3.5-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock* ./
COPY vendor/eslint-config ./vendor/eslint-config

RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist

EXPOSE 3100

CMD ["bun", "run", "dist/server.mjs"]
