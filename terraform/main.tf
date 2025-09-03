# SVOA Lea Platform - EU/EES Infrastructure Foundation
# Following TDD approach - this minimal implementation makes infrastructure tests pass

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # EU/EES compliant backend configuration
  backend "s3" {
    # Will be configured with EU region
    encrypt = true
  }
}

# EU/EES compliant provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "svoa-lea"
      Environment = var.environment
      Compliance  = "EU-EES"
      DataClass   = "confidential"
      Owner       = "svoa-team"
    }
  }
}

# Variables for EU/EES compliance
variable "aws_region" {
  description = "AWS region for EU/EES compliance"
  type        = string
  default     = "eu-north-1"  # Sweden
  
  validation {
    condition = can(regex("^eu-", var.aws_region))
    error_message = "Region must be in EU for EU/EES compliance."
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
  
  validation {
    condition = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# VPC for network segmentation
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "svoa-lea-${var.environment}"
  }
}

# Data residency validation
data "aws_region" "current" {}

# Compliance check - ensure EU/EES region
resource "null_resource" "eu_compliance_check" {
  triggers = {
    region = data.aws_region.current.name
  }
  
  provisioner "local-exec" {
    command = <<EOF
      if [[ ! "${data.aws_region.current.name}" =~ ^eu- ]]; then
        echo "ERROR: Non-EU region detected. EU/EES compliance requires EU region."
        exit 1
      fi
      echo "✅ EU/EES compliance verified: ${data.aws_region.current.name}"
    EOF
  }
}

# Output for verification
output "infrastructure_status" {
  value = {
    vpc_id                = aws_vpc.main.id
    region                = data.aws_region.current.name
    compliance_verified   = "EU/EES"
    environment          = var.environment
  }
}