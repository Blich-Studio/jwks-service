# JWKS Service

A production-ready JWT issuer service that provides JWKS (JSON Web Key Set) endpoints and token generation capabilities. Built with Fastify and deployed on Google Cloud Run.

## Features

- 🔐 **JWT Token Issuing**: Generate RS256-signed JWT tokens with customizable claims
- 🔑 **JWKS Endpoint**: Public endpoint exposing JWK for token verification
- 🛡️ **API Key Protection**: Secure token endpoint with API key authentication
- ☁️ **Cloud-Native**: Designed for Google Cloud Run with Secret Manager integration
- ⚡ **High Performance**: Built on Fastify with rate limiting and CORS support
- 🔒 **Security**: Helmet, rate limiting, timing-safe comparisons
- ✅ **Validation**: Zod-based request and environment validation

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client    │─────▶│ API Gateway  │◀────▶│ JWKS Service│
└─────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            │                      │
                     Verifies JWT          Issues JWT Tokens
                     using JWKS            (API Key Protected)
```

## Quick Start

### Prerequisites

- Bun 1.0+ or Node.js 20+
- Google Cloud Project (for production)
- RSA-2048 key pair (for local development)

### Installation

```bash
bun install
```

### Local Development

1. Copy environment template:
```bash
cp .env.example .env
```

2. Generate RSA keys (if needed):
```bash
openssl genrsa -out private-key.pem 2048
openssl rsa -in private-key.pem -pubout -out public-key.pem
```

3. Start development server:
```bash
bun run dev
```

4. Test the service:
```bash
# Health check
curl http://localhost:3100/health

# Get JWKS (public keys)
curl http://localhost:3100/.well-known/jwks.json

# Issue a token (requires API key)
curl -X POST http://localhost:3100/token \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"sub":"user123","role":"reader","email":"user@example.com"}'
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `3100` |
| `JWT_ISSUER` | Yes | JWT issuer claim (e.g., https://jwks.yourdomain.com) | - |
| `JWT_AUDIENCE` | Yes | Default audience claim | - |
| `JWT_KID` | Yes | Key ID for JWT header | - |
| `JWT_EXPIRES_IN` | No | Token expiration time | `15m` |
| `JWKS_CACHE_MAX_AGE` | No | JWKS cache duration (seconds) | `300` |
| `TOKEN_API_KEY` | No | API key for /token endpoint protection | - |
| `LOCAL_PRIVATE_KEY` | Conditional | RSA private key (PEM format) | - |
| `GOOGLE_PRIVATE_KEY_SECRET` | Conditional | Secret Manager resource path | - |

**Note**: Provide either `LOCAL_PRIVATE_KEY` or `GOOGLE_PRIVATE_KEY_SECRET`.



## API Reference

### GET `/.well-known/jwks.json`

Returns the public key set for JWT verification.

**Response:**
```json
{
  "keys": [{
    "kty": "RSA",
    "kid": "prod-key-1",
    "use": "sig",
    "alg": "RS256",
    "n": "...",
    "e": "AQAB"
  }]
}
```

### POST `/token`

Issues a signed JWT token. Requires API key authentication.

**Headers:**
- `X-API-Key`: Your API key (if `TOKEN_API_KEY` is configured)
- `Content-Type`: `application/json`

**Request Body:**
```json
{
  "sub": "user-id",
  "role": "admin" | "writer" | "reader",
  "email": "user@example.com",
  "displayName": "User Name",
  "permissions": ["resource:action"],
  "metadata": {},
  "audience": "custom-audience",
  "expiresIn": "30m"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "expiresIn": "30m",
  "kid": "prod-key-1",
  "issuer": "https://jwks.yourdomain.com",
  "audience": "blich-api"
}
```

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Deployment

### Google Cloud Run

1. **Create secrets in Secret Manager:**
```bash
# Private key
echo -n "$(cat private-key.pem)" | gcloud secrets create auth-issuer-private-key-rsa --data-file=-

# API key
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create jwks-token-api-key --data-file=-
```

2. **Grant permissions:**
```bash
# Allow Cloud Run to access secrets
gcloud secrets add-iam-policy-binding auth-issuer-private-key-rsa \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwks-token-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

3. **Deploy:**
```bash
gcloud builds submit --config=cloudbuild.yaml
```

4. **Enable public access (for JWKS endpoint):**
```bash
gcloud run services add-iam-policy-binding jwks-service \
  --region=europe-west1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

### Docker

```bash
# Build
docker build -t jwks-service .

# Run
docker run -p 3100:3100 \
  -e JWT_ISSUER=https://jwks.example.com \
  -e JWT_AUDIENCE=api \
  -e JWT_KID=dev-key-1 \
  -e LOCAL_PRIVATE_KEY="$(cat private-key.pem)" \
  -e TOKEN_API_KEY=your-secret-key \
  jwks-service
```

## Development

```bash
# Development with hot reload
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Run tests
bun run test

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix
```

## Security

- ✅ API key authentication uses timing-safe comparison
- ✅ Private keys stored in Secret Manager (production)
- ✅ Rate limiting (300 requests/minute)
- ✅ CORS configured
- ✅ Helmet security headers
- ✅ No sensitive data in logs
- ✅ RSA-2048 minimum key size

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions, please open an issue on GitHub.
