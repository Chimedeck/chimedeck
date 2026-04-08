# modules/ec2-single

Provisions a single EC2 instance with a static public Elastic IP. User data is rendered via `templatefile` so the instance can pull its Docker image from ECR and load secrets from Secrets Manager at boot — no credentials are stored in the AMI.

## Usage

```hcl
module "app" {
  source = "../../modules/ec2-single"

  name_prefix             = "myapp-staging"
  ami_id                  = "ami-0abcdef1234567890"
  instance_type           = "t3.small"
  subnet_id               = module.vpc.public_subnet_ids[0]
  security_group_ids      = [module.security_groups.app_sg_id]
  iam_instance_profile    = aws_iam_instance_profile.app.name
  secrets_arn             = "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp-staging-abc123"
  ecr_image_url           = "123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:v1.2.3"
  user_data_template_path = "${path.root}/../../scripts/startup.sh"

  tags = {
    Environment = "staging"
    Project     = "myapp"
  }
}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.5 |
| aws | >= 5.0 |

## Variables

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name_prefix` | `string` | — | Prefix applied to all resource Name tags |
| `ami_id` | `string` | — | AMI ID (custom baked AMI with Docker + AWS CLI) |
| `instance_type` | `string` | `"t3.small"` | EC2 instance type |
| `subnet_id` | `string` | — | Public subnet ID |
| `security_group_ids` | `list(string)` | — | Security group IDs to attach |
| `iam_instance_profile` | `string` | — | IAM instance profile name (grants ECR pull + Secrets Manager read) |
| `secrets_arn` | `string` | — | Secrets Manager ARN for app env vars |
| `ecr_image_url` | `string` | — | Full ECR image URL including tag |
| `user_data_template_path` | `string` | — | Path to `startup.sh` templatefile |
| `tags` | `map(string)` | `{}` | Additional tags merged onto every resource |

## Outputs

| Name | Description |
|------|-------------|
| `instance_id` | EC2 instance ID |
| `public_ip` | Public IP address of the Elastic IP |
| `eip_allocation_id` | Allocation ID of the Elastic IP |
| `private_ip` | Private IP address of the instance |

## Notes

- The instance is replaced (`create_before_destroy`) whenever user data changes, which happens when `ecr_image_url` or `secrets_arn` changes. This gives a clean blue/green-style replacement for single-instance deployments.
- The IAM instance profile must grant `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `secretsmanager:GetSecretValue` at minimum.
- `startup.sh` receives `ecr_image_url` and `secrets_arn` as template variables; see `terraform/scripts/startup.sh` for the full template.
