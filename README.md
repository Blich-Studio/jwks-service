# JWKS Service

Fastify service that issues RS256 tokens and exposes a JWKS endpoint so downstream services can validate them. It loads RSA keys from Google Secret Manager in production and supports PEM-based keys in development.

## Features

- Fastify 5 with helmet, rate limiting, CORS, sensible defaults, and `/health`
- `jose`-powered RSA import/export and JWT signing
- JWKS cache headers to reduce repeated fetches
- Optional API-key protection on `/token`
- Zod-based environment validation with actionable error messages

## Prerequisites

- Node.js 20+
- Access to Google Secret Manager (or a local PEM RSA key pair)
- `gcloud auth application-default login` when testing Secret Manager locally

## Installation

```bash
cd apps/jwks-service
bun install
```

## Environment Variables

Reference `.env.example` and set the variables below. Multiline PEM values can keep escaped `\n`; the service restores them at runtime.

| Variable                    | Required | Description                                                                                         | Default |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------- | ------- |
| `PORT`                      | No       | Port Fastify listens on                                                                             | `3100`  |
| `JWT_ISSUER`                | Yes      | Value used for the `iss` claim                                                                      | –       |
| `JWT_AUDIENCE`              | Yes      | Default `aud` claim                                                                                 | –       |
| `JWT_KID`                   | Yes      | Key identifier in JWT header & JWKS                                                                 | –       |
| `JWT_EXPIRES_IN`            | No       | Default token lifetime (`zeit/ms` format)                                                           | `15m`   |
| `JWKS_CACHE_MAX_AGE`        | No       | Seconds for JWKS `Cache-Control` header                                                             | `300`   |
| `TOKEN_API_KEY`             | Cond.    | Required `x-api-key` header value for `/token`                                                      | –       |
| `GOOGLE_PRIVATE_KEY_SECRET` | Cond.    | Secret Manager resource (`projects/<id>/secrets/<name>/versions/latest`) containing the private key | –       |
| `LOCAL_PRIVATE_KEY`         | Cond.    | PEM private key used when Secret Manager is not configured                                          | –       |
| `LOCAL_PUBLIC_KEY`          | Cond.    | PEM public key used to publish JWKS                                                                 | –       |

> Provide either `GOOGLE_PRIVATE_KEY_SECRET` **or** both `LOCAL_PRIVATE_KEY` and `LOCAL_PUBLIC_KEY`.

## Running Locally

```bash
# Watch mode with Vite Node
bun run dev

# Type-check and emit optimized ESM bundle via Vite
bun run build

# Run the compiled output (same command works for preview)
bun run start

# Lint sources
bun run lint

# Run unit/integration tests
bun run test
```

Verify the service is up:

```bash
curl http://localhost:3100/health
```

## Docker

The repository now includes a multi-stage Dockerfile optimized for Cloud Run. Build and run it from the repo root:

```bash
# Build image
docker build -f apps/jwks-service/Dockerfile -t jwks-service .

# Run container (override env as needed)
docker run --rm -p 3100:3100 \
  -e PORT=3100 \
  -e JWT_ISSUER=https://auth.example.com \
  -e JWT_AUDIENCE=blich-api \
  -e JWT_KID=local-dev-1 \
  -e LOCAL_PRIVATE_KEY="$(cat private.pem)" \
  -e LOCAL_PUBLIC_KEY="$(cat public.pem)" \
  jwks-service
```

When deploying to Cloud Run use the same image and supply either `GOOGLE_PRIVATE_KEY_SECRET` or the local PEM pair via secrets. The container listens on `PORT` (defaults to `3100`).

## Secret Manager

When `GOOGLE_PRIVATE_KEY_SECRET` is defined, the service authenticates via Application Default Credentials, fetches the PEM once, and stores it in-memory. For local development you can either export local PEMs or run `gcloud auth application-default login` so the Secret Manager client works.

## API

### `GET /.well-known/jwks.json`

Returns the public key set with HTTP caching. Example response:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "issuer-key",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

### `POST /token`

Issues a signed JWT. Requires `x-api-key` when `TOKEN_API_KEY` is set.

**Request body**

```json
{
  "sub": "user-id",
  "role": "admin",
  "email": "user@example.com",
  "displayName": "Example User",
  "permissions": ["blog:write"],
  "metadata": { "department": "eng" },
  "audience": ["web"],
  "expiresIn": "30m"
}
```

**Response**

```json
{
  "token": "<jwt>",
  "expiresIn": "30m",
  "kid": "issuer-key",
  "issuer": "https://issuer.example.com",
  "audience": ["web"]
}
```

Payload validation errors are returned as structured 400 responses sourced from Zod.

## Deployment Notes

- Run on Node 20+ (ESM).
- Ensure either Secret Manager access or PEM env vars are available.
- Store `TOKEN_API_KEY` in a secret manager if the token endpoint must stay private.
