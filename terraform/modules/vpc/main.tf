# ── Default VPC data sources (create_vpc = false) ────────────────────────────

data "aws_vpc" "default" {
  count   = var.create_vpc ? 0 : 1
  default = true
}

data "aws_subnets" "default" {
  count = var.create_vpc ? 0 : 1

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default[0].id]
  }
}

# ── VPC (create_vpc = true) ───────────────────────────────────────────────────

resource "aws_vpc" "this" {
  count = var.create_vpc ? 1 : 0

  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    { Name = "${var.name_prefix}-vpc" },
    var.tags,
  )
}

# ── Internet Gateway ──────────────────────────────────────────────────────────

resource "aws_internet_gateway" "this" {
  count = var.create_vpc ? 1 : 0

  vpc_id = aws_vpc.this[0].id

  tags = merge(
    { Name = "${var.name_prefix}-igw" },
    var.tags,
  )
}

# ── Public subnets — one per AZ ───────────────────────────────────────────────

resource "aws_subnet" "public" {
  count = var.create_vpc ? length(var.availability_zones) : 0

  vpc_id                  = aws_vpc.this[0].id
  availability_zone       = var.availability_zones[count.index]
  # Carve /24 slices from the first half of the VPC CIDR for public subnets.
  # index 0 → x.x.0.0/24, index 1 → x.x.1.0/24, etc.
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  map_public_ip_on_launch = true

  tags = merge(
    { Name = "${var.name_prefix}-public-${var.availability_zones[count.index]}" },
    var.tags,
  )
}

# ── Private subnets — one per AZ ─────────────────────────────────────────────

resource "aws_subnet" "private" {
  count = var.create_vpc ? length(var.availability_zones) : 0

  vpc_id            = aws_vpc.this[0].id
  availability_zone = var.availability_zones[count.index]
  # Offset by 100 to avoid overlap with public subnets.
  # index 0 → x.x.100.0/24, index 1 → x.x.101.0/24, etc.
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 100)

  tags = merge(
    { Name = "${var.name_prefix}-private-${var.availability_zones[count.index]}" },
    var.tags,
  )
}

# ── Public route table ────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  count = var.create_vpc ? 1 : 0

  vpc_id = aws_vpc.this[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this[0].id
  }

  tags = merge(
    { Name = "${var.name_prefix}-public-rt" },
    var.tags,
  )
}

resource "aws_route_table_association" "public" {
  count = var.create_vpc ? length(var.availability_zones) : 0

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

# ── Private route tables — one per AZ ────────────────────────────────────────
# Default route (0.0.0.0/0 → NAT GW) is added by the nat-gateway module after
# the NAT Gateway is created, so these tables start with no default route.

resource "aws_route_table" "private" {
  count = var.create_vpc ? length(var.availability_zones) : 0

  vpc_id = aws_vpc.this[0].id

  tags = merge(
    { Name = "${var.name_prefix}-private-rt-${var.availability_zones[count.index]}" },
    var.tags,
  )
}

resource "aws_route_table_association" "private" {
  count = var.create_vpc ? length(var.availability_zones) : 0

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
