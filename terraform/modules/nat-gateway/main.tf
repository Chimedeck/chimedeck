# ── Elastic IP ────────────────────────────────────────────────────────────────

resource "aws_eip" "nat" {
  # 'domain = "vpc"' is required for EIPs used with NAT Gateways (replaces the
  # deprecated 'vpc = true' argument introduced in AWS provider ≥ 4.x).
  domain = "vpc"

  tags = merge(
    { Name = "${var.name_prefix}-nat-eip" },
    var.tags,
  )
}

# ── NAT Gateway ───────────────────────────────────────────────────────────────

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = var.public_subnet_id

  # NAT Gateway must wait for the EIP allocation to complete.
  depends_on = [aws_eip.nat]

  tags = merge(
    { Name = "${var.name_prefix}-nat-gw" },
    var.tags,
  )
}

# ── Private route table default routes ────────────────────────────────────────
# Add 0.0.0.0/0 → NAT Gateway to every private route table supplied by the
# caller (typically one per AZ from the vpc module's private_route_table_ids).

resource "aws_route" "private_nat" {
  count = length(var.private_route_table_ids)

  route_table_id         = var.private_route_table_ids[count.index]
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this.id
}
