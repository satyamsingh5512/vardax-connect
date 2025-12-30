# Fortress Terraform Configuration
# Security: Infrastructure as Code for reproducible deployments
# 
# This is a MINIMAL example showing CA and Vault placeholders.
# Production deployments should use proper modules and state management.

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
  
  # Backend configuration (uncomment for production)
  # backend "s3" {
  #   bucket         = "fortress-terraform-state"
  #   key            = "fortress/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "fortress-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "Fortress"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "ca_common_name" {
  description = "Common name for the private CA"
  type        = string
  default     = "Fortress Private CA"
}

# Private CA for mTLS
# Security: Self-managed CA for client certificate issuance
resource "aws_acmpca_certificate_authority" "fortress_ca" {
  type = "ROOT"
  
  certificate_authority_configuration {
    key_algorithm     = "RSA_4096"
    signing_algorithm = "SHA512WITHRSA"
    
    subject {
      common_name         = var.ca_common_name
      organization        = "Fortress Security"
      organizational_unit = "Security Operations"
      country             = "US"
    }
  }
  
  revocation_configuration {
    crl_configuration {
      enabled            = true
      expiration_in_days = 7
      s3_bucket_name     = aws_s3_bucket.crl_bucket.id
    }
  }
  
  # FIPS 140-3 consideration: Use HSM-backed keys in production
  # key_storage_security_standard = "FIPS_140_2_LEVEL_3_OR_HIGHER"
  
  tags = {
    Name = "fortress-private-ca"
  }
}

# S3 bucket for CRL distribution
resource "aws_s3_bucket" "crl_bucket" {
  bucket = "fortress-crl-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = {
    Name = "fortress-crl-bucket"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_public_access_block" "crl_bucket" {
  bucket = aws_s3_bucket.crl_bucket.id
  
  block_public_acls       = false  # CRL needs to be publicly accessible
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Secrets Manager for sensitive configuration
# Security: Centralized secret storage with rotation
resource "aws_secretsmanager_secret" "fortress_secrets" {
  name        = "fortress/${var.environment}/app-secrets"
  description = "Fortress application secrets"
  
  # Enable automatic rotation (configure rotation lambda separately)
  # rotation_rules {
  #   automatically_after_days = 30
  # }
  
  tags = {
    Name = "fortress-app-secrets"
  }
}

# KMS key for encryption
# Security: Customer-managed key for data encryption
resource "aws_kms_key" "fortress_key" {
  description             = "Fortress encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  
  # FIPS 140-3: AWS KMS uses FIPS 140-2 validated HSMs
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })
  
  tags = {
    Name = "fortress-kms-key"
  }
}

resource "aws_kms_alias" "fortress_key" {
  name          = "alias/fortress-${var.environment}"
  target_key_id = aws_kms_key.fortress_key.key_id
}

# Data sources
data "aws_caller_identity" "current" {}

# Outputs
output "ca_arn" {
  description = "ARN of the private CA"
  value       = aws_acmpca_certificate_authority.fortress_ca.arn
}

output "secrets_arn" {
  description = "ARN of the secrets manager secret"
  value       = aws_secretsmanager_secret.fortress_secrets.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key"
  value       = aws_kms_key.fortress_key.arn
}
