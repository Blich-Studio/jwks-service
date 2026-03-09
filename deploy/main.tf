# JWKS Service - Cloud Run Deployment
# Minimal JWT key service

# Import existing Cloud Run service (remove after first successful apply)
import {
  to = module.jwks_service.google_cloud_run_v2_service.main
  id = "projects/blichstudio-infras/locations/europe-west1/services/jwks-service"
}

provider "google" {
  project = data.terraform_remote_state.shared.outputs.project_id
  region  = data.terraform_remote_state.shared.outputs.region
}

data "terraform_remote_state" "shared" {
  backend = "gcs"
  config = {
    bucket = "blichstudio-infras-terraform-state"
    prefix = "terraform/state/shared"
  }
}

module "jwks_service" {
  source = "../terraform-modules/modules/cloud-run"

  service_name    = "jwks-service"
  environment     = data.terraform_remote_state.shared.outputs.environment
  region          = data.terraform_remote_state.shared.outputs.region
  project_id      = data.terraform_remote_state.shared.outputs.project_id
  container_image = var.container_image
  port            = 3100

  cpu_limit    = "1"
  memory_limit = "512Mi"

  min_instances = 0
  max_instances = 3

  cpu_idle          = true
  startup_cpu_boost = false
  request_timeout   = 60

  enable_vpc_access = false

  service_account_email = data.terraform_remote_state.shared.outputs.service_account_emails["jwks-service"]
  allow_public_access   = true

  environment_variables = {
    JWT_ISSUER         = "https://jwks.blichstudio.com"
    JWT_AUDIENCE       = "blich-api"
    JWT_KID            = "prod-key-1"
    JWT_EXPIRES_IN     = "15m"
    JWKS_CACHE_MAX_AGE = "300"
  }

  secret_environment_variables = {
    LOCAL_PRIVATE_KEY = { secret_name = "jwt-private-key", version = "latest" }
    TOKEN_API_KEY     = { secret_name = "jwks-token-api-key", version = "latest" }
  }

  health_check_path = "/.well-known/jwks.json"

  labels = { service = "jwks" }
}
