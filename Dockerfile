# syntax=docker/dockerfile:1.5

FROM node:20-slim AS builder
WORKDIR /usr/src/app
ENV NODE_ENV=development

COPY package*.json ./
COPY turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm install
RUN npm run build --workspace=@blich-studio/shared
RUN npm run build --workspace=jwks-service

FROM node:20-slim AS prod-deps
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/jwks-service/package*.json ./apps/jwks-service/
COPY packages/shared/package*.json ./packages/shared/
COPY --from=builder /usr/src/app/packages/shared/dist ./packages/shared/dist

RUN npm install --omit=dev --workspaces --include-workspace-root=false --workspace=apps/jwks-service

FROM node:20-slim AS runner
WORKDIR /usr/src/app/apps/jwks-service
ENV NODE_ENV=production

COPY --from=prod-deps /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=prod-deps /usr/src/app/package*.json /usr/src/app/
COPY --from=prod-deps /usr/src/app/apps/jwks-service/package*.json ./
COPY --from=prod-deps /usr/src/app/packages/shared /usr/src/app/packages/shared
COPY --from=builder /usr/src/app/apps/jwks-service/dist ./dist

EXPOSE 3100
CMD ["node", "dist/main.js"]
