# ── Provider aliases ──────────────────────────────────────────────────────────
# Modules that use provider aliases must declare them via configuration_aliases
# so Terraform knows to expect two distinct aws provider instances from the
# caller. Without this block, terraform validate rejects the alias references.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
      configuration_aliases = [aws.requester, aws.accepter]
    }
  }
}

# ── VPC Peering Connection (requester side) ───────────────────────────────────
# The requester initiates the cross-region peering request. Cross-region peering
# requires auto_accept = false; the accepter resource below completes the
# handshake in the peer region via the 'aws.accepter' provider alias.

resource "aws_vpc_peering_connection" "this" {
  provider = aws.requester

  vpc_id      = var.requester_vpc_id
  peer_vpc_id = var.accepter_vpc_id
  peer_region = var.accepter_region

  # auto_accept must be false for cross-region peering; the accepter resource
  # handles acceptance in the peer region.
  auto_accept = false

  tags = merge(
    { Name = "${var.requester_region}-to-${var.accepter_region}-peering" },
    var.tags,
  )
}

# ── VPC Peering Connection Accepter (accepter side) ───────────────────────────

resource "aws_vpc_peering_connection_accepter" "this" {
  provider = aws.accepter

  vpc_peering_connection_id = aws_vpc_peering_connection.this.id
  auto_accept               = true

  tags = merge(
    { Name = "${var.accepter_region}-accepts-${var.requester_region}-peering" },
    var.tags,
  )
}

# ── Routes on the requester side ──────────────────────────────────────────────
# Each route table in the requester VPC gets a route for the accepter CIDR,
# forwarding traffic through the peering connection.

resource "aws_route" "requester_to_accepter" {
  provider = aws.requester
  count    = length(var.requester_route_table_ids)

  route_table_id            = var.requester_route_table_ids[count.index]
  destination_cidr_block    = var.accepter_cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.this.id

  depends_on = [aws_vpc_peering_connection_accepter.this]
}

# ── Routes on the accepter side ───────────────────────────────────────────────
# Each route table in the accepter VPC gets a route for the requester CIDR,
# forwarding traffic through the peering connection.

resource "aws_route" "accepter_to_requester" {
  provider = aws.accepter
  count    = length(var.accepter_route_table_ids)

  route_table_id            = var.accepter_route_table_ids[count.index]
  destination_cidr_block    = var.requester_cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.this.id

  depends_on = [aws_vpc_peering_connection_accepter.this]
}
