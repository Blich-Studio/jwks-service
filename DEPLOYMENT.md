# JWKS Service - GCP Deployment Guide

This guide walks you through deploying the JWKS service to Google Cloud Platform.

## Prerequisites

- Google Cloud Project with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed (for local testing)
- Permissions: Cloud Run Admin, Secret Manager Admin, Cloud Build Editor

## Step 1: Generate RSA Key Pair

```bash
# Generate RSA-2048 private key
openssl genrsa -out private-key.pem 2048

# Extract public key
openssl rsa -in private-key.pem -pubout -out public-key.pem

# View the keys (you'll store these in Secret Manager)
cat private-key.pem
cat public-key.pem
```

## Step 2: Set Up Google Cloud Project

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="europe-west1"

# Configure gcloud
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com
```

## Step 3: Store Secrets in Secret Manager

```bash
# Store private key
cat private-key.pem | gcloud secrets create auth-issuer-private-key-rsa \
  --data-file=- \
  --replication-policy="automatic"

# Generate and store API key for /token endpoint
openssl rand -hex 32 > api-key.txt
cat api-key.txt | gcloud secrets create jwks-token-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Grant Cloud Run service account access to secrets
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding auth-issuer-private-key-rsa \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwks-token-api-key \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 4: Build and Deploy with Cloud Build

```bash
# Navigate to jwks-service directory
cd jwks-service

# Submit build to Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION=$REGION,_JWT_ISSUER=https://jwks.blichstudio.com,_JWT_AUDIENCE=blich-api,_JWT_KID=prod-key-1

# Get the service URL
gcloud run services describe jwks-service --region=$REGION --format='value(status.url)'
```

The service will be deployed with:
- **Custom Domain**: `https://jwks.blichstudio.com`
- **JWKS endpoint**: `https://jwks.blichstudio.com/.well-known/jwks.json`
- **Token endpoint**: `https://jwks.blichstudio.com/token` (requires `x-api-key` header)
- **Health check**: `https://jwks.blichstudio.com/health`

## Step 5: Test the Deployment

```bash
# Get service URL
export JWKS_URL=$(gcloud run services describe jwks-service --region=$REGION --format='value(status.url)')

# Test health endpoint
curl $JWKS_URL/health

# Test JWKS endpoint
curl $JWKS_URL/.well-known/jwks.json

# Test token generation (use the API key from Step 3)
export API_KEY=$(gcloud secrets versions access latest --secret="jwks-token-api-key")
curl -X POST $JWKS_URL/token \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sub": "test-user", "email": "test@example.com"}'
```

## Step 6: Configure API Gateway Integration

Update your api-gateway `.env`:

```env
# JWKS Service Configuration
JWKS_URL=https://jwks.blichstudio.com/.well-known/jwks.json
JWKS_TOKEN_ENDPOINT=https://jwks.blichstudio.com/token
JWKS_TOKEN_API_KEY=<value-from-secret-manager>
JWT_ISSUER=https://jwks.blichstudio.com
JWT_AUDIENCE=blich-api
```

## Step 7: Set Up Continuous Deployment (Optional)

Create a Cloud Build trigger:

```bash
gcloud builds triggers create github \
  --name="jwks-service-deploy" \
  --repo-name="your-repo" \
  --repo-owner="Blich-Studio" \
  --branch-pattern="^main$" \
  --build-config="jwks-service/cloudbuild.yaml" \
  --included-files="jwks-service/**"
```

## Security Considerations

1. **API Key Protection**: The `TOKEN_API_KEY` should only be known to api-gateway
2. **JWKS Public**: The JWKS endpoint is public (needed for token verification)
3. **Token Expiry**: Tokens expire in 15 minutes by default (configurable)
4. **Rate Limiting**: Fastify rate-limit is enabled
5. **CORS**: Configure allowed origins in production

## Monitoring

```bash
# View logs
gcloud run services logs read jwks-service --region=$REGION --limit=50

# Monitor metrics in Cloud Console
# https://console.cloud.google.com/run/detail/$REGION/jwks-service/metrics
```

## Cleanup

```bash
# Delete the service
gcloud run services delete jwks-service --region=$REGION

# Delete secrets
gcloud secrets delete auth-issuer-private-key-rsa
gcloud secrets delete jwks-token-api-key

# Delete container images
gcloud container images delete gcr.io/$PROJECT_ID/jwks-service --quiet
```

## Troubleshooting

### Issue: Service won't start

Check logs:
```bash
gcloud run services logs read jwks-service --region=$REGION --limit=100
```

Common issues:
- Secret access permissions not granted
- Invalid RSA key format
- Environment variables misconfigured

### Issue: Token generation fails

Verify API key:
```bash
gcloud secrets versions access latest --secret="jwks-token-api-key"
```

### Issue: JWKS endpoint returns 404

Check service is running:
```bash
gcloud run services describe jwks-service --region=$REGION
```

## Step 8: Map Custom Domain

Map `jwks.blichstudio.com` to the Cloud Run service:

```bash
# Add domain mapping
gcloud run domain-mappings create \
  --service=jwks-service \
  --domain=jwks.blichstudio.com \
  --region=$REGION

# Get DNS records to configure
gcloud run domain-mappings describe \
  --domain=jwks.blichstudio.com \
  --region=$REGION
```

Add the returned DNS records to your domain registrar:
- Type: `A` or `AAAA`
- Name: `jwks`
- Value: (provided by the command above)

Verification can take 15-30 minutes.

## Next Steps

1. **Integrate with API Gateway**: Add JWT verification middleware
2. **Update blich-cms**: Replace mock auth with real API calls
3. **Set up monitoring**: Configure alerts for service health
4. **SSL Certificate**: Auto-provisioned by Cloud Run for custom domain
