output "service_url" {
  description = "JWKS Service Cloud Run URL"
  value       = module.jwks_service.service_uri
}

output "latest_revision" {
  description = "Latest deployed revision"
  value       = module.jwks_service.latest_revision
}
