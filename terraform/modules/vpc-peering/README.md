# modules/vpc-peering

Creates a cross-region VPC peering connection and updates route tables on both sides so each VPC can route traffic to the other's private CIDR over the peering link.

The module requires two AWS provider aliases (`aws.requester` and `aws.accepter`) to be passed by the caller, one configured for each region involved in the peering.

## Usage

```hcl
provider "aws" {
  alias  = "primary"
  region = "us-east-1"
}

provider "aws" {
  alias  = "secondary"
  region = "eu-west-1"
}

module "vpc_peering" {
  source = "../../modules/vpc-peering"

  providers = {
    aws.requester = aws.primary
    aws.accepter  = aws.secondary
  }

  requester_vpc_id          = module.vpc_primary.vpc_id
  requester_region          = "us-east-1"
  requester_cidr_block      = "10.0.0.0/16"
  requester_route_table_ids = module.vpc_primary.private_route_table_ids

  accepter_vpc_id          = module.vpc_secondary.vpc_id
  accepter_region          = "eu-west-1"
  accepter_cidr_block      = "10.1.0.0/16"
  accepter_route_table_ids = module.vpc_secondary.private_route_table_ids

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

## Provider Aliases

This module requires two provider aliases to be passed via the `providers` argument:

| Alias | Description |
|-------|-------------|
| `aws.requester` | AWS provider configured for the requester VPC's region |
| `aws.accepter` | AWS provider configured for the accepter VPC's region |

## Variables

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `requester_vpc_id` | `string` | — | VPC ID of the requesting side |
| `requester_region` | `string` | — | AWS region of the requester |
| `requester_cidr_block` | `string` | — | CIDR of the requester VPC (added to accepter routes) |
| `requester_route_table_ids` | `list(string)` | — | Route tables to update on requester side |
| `accepter_vpc_id` | `string` | — | VPC ID of the accepting side |
| `accepter_region` | `string` | — | AWS region of the accepter |
| `accepter_cidr_block` | `string` | — | CIDR of the accepter VPC (added to requester routes) |
| `accepter_route_table_ids` | `list(string)` | — | Route tables to update on accepter side |
| `tags` | `map(string)` | `{}` | Additional tags merged onto every resource |

## Outputs

| Name | Description |
|------|-------------|
| `peering_connection_id` | ID of the VPC peering connection |
| `peering_connection_status` | Acceptance status of the peering connection (e.g. `active`) |

## Notes

- Both VPCs must be in the **same AWS account**. Cross-account peering requires additional `aws_vpc_peering_connection_options` configuration not covered by this module.
- Route table IDs passed to `requester_route_table_ids` / `accepter_route_table_ids` should include all private route tables in the respective VPC that need to reach the peer CIDR. Public route tables rarely need peering routes unless instances in public subnets must communicate privately.
- CIDR blocks must not overlap between the two VPCs.
