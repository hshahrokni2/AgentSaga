"""
Test Suite: Network Segmentation and Firewall Rules
Target: Network isolation and security boundaries for SVOA Lea platform
Status: All tests should FAIL initially (TDD approach)
"""

import pytest
import boto3
import ipaddress
from typing import Dict, List, Set, Tuple, Any
import json
import subprocess
from dataclasses import dataclass
from enum import Enum


class NetworkZone(Enum):
    """Network security zones"""
    PUBLIC = "public"
    PRIVATE = "private"
    DATA = "data"
    MANAGEMENT = "management"
    DMZ = "dmz"


@dataclass
class NetworkSegment:
    """Network segment definition"""
    name: str
    zone: NetworkZone
    cidr: str
    allowed_ingress: List[Tuple[str, int, str]]  # (source_cidr, port, protocol)
    allowed_egress: List[Tuple[str, int, str]]   # (dest_cidr, port, protocol)


class TestNetworkSegmentation:
    """
    Tests for network segmentation, firewall rules, and traffic isolation.
    Ensures proper network boundaries and security zones.
    """

    @pytest.fixture
    def network_architecture(self) -> Dict[str, NetworkSegment]:
        """Define expected network architecture"""
        return {
            "public_subnet": NetworkSegment(
                name="public-subnet",
                zone=NetworkZone.PUBLIC,
                cidr="10.0.1.0/24",
                allowed_ingress=[
                    ("0.0.0.0/0", 443, "tcp"),  # HTTPS from internet
                    ("0.0.0.0/0", 80, "tcp"),   # HTTP from internet (redirect)
                ],
                allowed_egress=[
                    ("10.0.2.0/24", 443, "tcp"),  # To private subnet
                    ("0.0.0.0/0", 443, "tcp"),     # HTTPS to internet
                ]
            ),
            "private_subnet": NetworkSegment(
                name="private-subnet",
                zone=NetworkZone.PRIVATE,
                cidr="10.0.2.0/24",
                allowed_ingress=[
                    ("10.0.1.0/24", 443, "tcp"),  # From public subnet
                    ("10.0.4.0/24", 22, "tcp"),   # SSH from management
                ],
                allowed_egress=[
                    ("10.0.3.0/24", 5432, "tcp"),  # To data subnet (PostgreSQL)
                    ("10.0.3.0/24", 6379, "tcp"),  # To data subnet (Redis)
                    ("0.0.0.0/0", 443, "tcp"),     # HTTPS to internet (via NAT)
                ]
            ),
            "data_subnet": NetworkSegment(
                name="data-subnet",
                zone=NetworkZone.DATA,
                cidr="10.0.3.0/24",
                allowed_ingress=[
                    ("10.0.2.0/24", 5432, "tcp"),  # PostgreSQL from private
                    ("10.0.2.0/24", 6379, "tcp"),  # Redis from private
                ],
                allowed_egress=[]  # Data subnet should not initiate connections
            ),
            "management_subnet": NetworkSegment(
                name="management-subnet",
                zone=NetworkZone.MANAGEMENT,
                cidr="10.0.4.0/24",
                allowed_ingress=[
                    ("192.168.0.0/16", 22, "tcp"),  # SSH from corporate VPN
                ],
                allowed_egress=[
                    ("10.0.0.0/16", 22, "tcp"),     # SSH to all internal subnets
                    ("10.0.0.0/16", 443, "tcp"),    # HTTPS to all internal subnets
                ]
            )
        }

    def test_vpc_configuration(self):
        """Test VPC configuration and isolation"""
        ec2 = boto3.client('ec2')
        
        # Get all VPCs
        vpcs = ec2.describe_vpcs()
        
        for vpc in vpcs['Vpcs']:
            vpc_id = vpc['VpcId']
            
            # Skip default VPC
            if vpc.get('IsDefault'):
                continue
            
            # Check CIDR blocks
            cidr_block = vpc['CidrBlock']
            network = ipaddress.ip_network(cidr_block)
            
            # Ensure private IP space
            assert network.is_private, f"VPC {vpc_id} using public IP space"
            
            # Check for IPv6
            ipv6_blocks = vpc.get('Ipv6CidrBlockAssociationSet', [])
            if ipv6_blocks:
                for ipv6 in ipv6_blocks:
                    assert ipv6['Ipv6CidrBlockState']['State'] == 'associated', \
                        f"IPv6 block not properly associated for VPC {vpc_id}"
            
            # Check DNS settings
            dns_attrs = ec2.describe_vpc_attribute(
                VpcId=vpc_id,
                Attribute='enableDnsSupport'
            )
            assert dns_attrs['EnableDnsSupport']['Value'], \
                f"DNS support not enabled for VPC {vpc_id}"
            
            dns_hostnames = ec2.describe_vpc_attribute(
                VpcId=vpc_id,
                Attribute='enableDnsHostnames'
            )
            assert dns_hostnames['EnableDnsHostnames']['Value'], \
                f"DNS hostnames not enabled for VPC {vpc_id}"

    def test_subnet_segmentation(self, network_architecture: Dict[str, NetworkSegment]):
        """Test that subnets are properly segmented"""
        ec2 = boto3.client('ec2')
        
        subnets = ec2.describe_subnets()
        
        # Map subnets by their tags/names
        subnet_map = {}
        for subnet in subnets['Subnets']:
            tags = {tag['Key']: tag['Value'] for tag in subnet.get('Tags', [])}
            name = tags.get('Name', '')
            
            if name:
                subnet_map[name] = subnet
        
        # Verify each expected segment exists
        for segment_name, segment in network_architecture.items():
            subnet_name = segment.name
            
            assert subnet_name in subnet_map, \
                f"Expected subnet {subnet_name} not found"
            
            subnet = subnet_map[subnet_name]
            
            # Verify CIDR block
            assert subnet['CidrBlock'] == segment.cidr, \
                f"Subnet {subnet_name} has incorrect CIDR: {subnet['CidrBlock']} != {segment.cidr}"
            
            # Check availability zone distribution
            if segment.zone in [NetworkZone.PRIVATE, NetworkZone.DATA]:
                # Critical subnets should be multi-AZ
                vpc_id = subnet['VpcId']
                related_subnets = [s for s in subnets['Subnets'] 
                                 if s['VpcId'] == vpc_id and 
                                 subnet_name in s.get('Tags', [])]
                
                azs = set(s['AvailabilityZone'] for s in related_subnets)
                assert len(azs) >= 2, \
                    f"Subnet {subnet_name} not distributed across multiple AZs"

    def test_network_acls(self, network_architecture: Dict[str, NetworkSegment]):
        """Test Network ACL configurations"""
        ec2 = boto3.client('ec2')
        
        nacls = ec2.describe_network_acls()
        
        for nacl in nacls['NetworkAcls']:
            nacl_id = nacl['NetworkAclId']
            
            # Skip default NACLs
            if nacl.get('IsDefault'):
                continue
            
            # Get associated subnets
            associations = nacl.get('Associations', [])
            
            for assoc in associations:
                subnet_id = assoc.get('SubnetId')
                
                if subnet_id:
                    # Get subnet details
                    subnet = ec2.describe_subnets(SubnetIds=[subnet_id])['Subnets'][0]
                    tags = {tag['Key']: tag['Value'] for tag in subnet.get('Tags', [])}
                    subnet_name = tags.get('Name', '')
                    
                    # Check rules
                    entries = nacl.get('Entries', [])
                    
                    # Verify deny rules for isolation
                    if 'data' in subnet_name.lower():
                        # Data subnet should have strict rules
                        egress_rules = [e for e in entries if e.get('Egress')]
                        
                        # Should deny most egress
                        deny_all = any(
                            e['RuleAction'] == 'deny' and 
                            e['CidrBlock'] == '0.0.0.0/0' and
                            e['RuleNumber'] < 32766  # Before default allow
                            for e in egress_rules
                        )
                        
                        assert deny_all, \
                            f"Data subnet {subnet_name} lacks egress denial rules"

    def test_security_group_isolation(self):
        """Test that security groups enforce proper isolation"""
        ec2 = boto3.client('ec2')
        
        security_groups = ec2.describe_security_groups()
        
        # Build a map of security group relationships
        sg_map = {sg['GroupId']: sg for sg in security_groups['SecurityGroups']}
        
        for sg in security_groups['SecurityGroups']:
            sg_name = sg['GroupName']
            
            # Skip default
            if sg_name == 'default':
                continue
            
            # Check for principle of least privilege
            for rule in sg['IpPermissions']:
                # Check source security groups
                for src_sg in rule.get('UserIdGroupPairs', []):
                    src_sg_id = src_sg['GroupId']
                    
                    # Verify no circular dependencies
                    src_sg_obj = sg_map.get(src_sg_id, {})
                    for src_rule in src_sg_obj.get('IpPermissions', []):
                        for pair in src_rule.get('UserIdGroupPairs', []):
                            assert pair['GroupId'] != sg['GroupId'], \
                                f"Circular dependency between {sg_name} and {src_sg_obj.get('GroupName')}"

    def test_route_table_configuration(self, network_architecture: Dict[str, NetworkSegment]):
        """Test route table configurations for proper traffic flow"""
        ec2 = boto3.client('ec2')
        
        route_tables = ec2.describe_route_tables()
        
        for rt in route_tables['RouteTables']:
            rt_id = rt['RouteTableId']
            
            # Get associated subnets
            associations = rt.get('Associations', [])
            
            for assoc in associations:
                subnet_id = assoc.get('SubnetId')
                
                if subnet_id:
                    # Get subnet details
                    subnet = ec2.describe_subnets(SubnetIds=[subnet_id])['Subnets'][0]
                    tags = {tag['Key']: tag['Value'] for tag in subnet.get('Tags', [])}
                    subnet_name = tags.get('Name', '')
                    
                    # Check routes based on subnet type
                    routes = rt.get('Routes', [])
                    
                    if 'public' in subnet_name.lower():
                        # Public subnet should have IGW route
                        has_igw = any(
                            'GatewayId' in route and route['GatewayId'].startswith('igw-')
                            for route in routes if route.get('DestinationCidrBlock') == '0.0.0.0/0'
                        )
                        assert has_igw, f"Public subnet {subnet_name} missing IGW route"
                        
                    elif 'private' in subnet_name.lower():
                        # Private subnet should have NAT route
                        has_nat = any(
                            'NatGatewayId' in route
                            for route in routes if route.get('DestinationCidrBlock') == '0.0.0.0/0'
                        )
                        assert has_nat, f"Private subnet {subnet_name} missing NAT route"
                        
                    elif 'data' in subnet_name.lower():
                        # Data subnet should not have internet route
                        has_internet = any(
                            route.get('DestinationCidrBlock') == '0.0.0.0/0'
                            for route in routes
                        )
                        assert not has_internet, f"Data subnet {subnet_name} has internet route"

    def test_nat_gateway_configuration(self):
        """Test NAT Gateway configuration for high availability"""
        ec2 = boto3.client('ec2')
        
        nat_gateways = ec2.describe_nat_gateways(
            Filter=[{'Name': 'state', 'Values': ['available']}]
        )
        
        assert len(nat_gateways['NatGateways']) > 0, "No NAT Gateways configured"
        
        # Check for multi-AZ deployment
        azs = set()
        for nat in nat_gateways['NatGateways']:
            # Check allocation
            assert nat.get('NatGatewayAddresses'), \
                f"NAT Gateway {nat['NatGatewayId']} has no elastic IP"
            
            # Get subnet for AZ
            subnet_id = nat['SubnetId']
            subnet = ec2.describe_subnets(SubnetIds=[subnet_id])['Subnets'][0]
            azs.add(subnet['AvailabilityZone'])
            
            # Check connectivity type
            assert nat.get('ConnectivityType') == 'public', \
                f"NAT Gateway {nat['NatGatewayId']} not publicly accessible"
        
        assert len(azs) >= 2, "NAT Gateways not deployed across multiple AZs"

    def test_vpc_peering_configuration(self):
        """Test VPC peering connections if they exist"""
        ec2 = boto3.client('ec2')
        
        peerings = ec2.describe_vpc_peering_connections(
            Filters=[{'Name': 'status-code', 'Values': ['active']}]
        )
        
        for peering in peerings['VpcPeeringConnections']:
            peering_id = peering['VpcPeeringConnectionId']
            
            # Check DNS resolution
            options = peering.get('RequesterVpcInfo', {}).get('PeeringOptions', {})
            
            assert options.get('AllowDnsResolutionFromRemoteVpc'), \
                f"DNS resolution not enabled for peering {peering_id}"
            
            # Check for overlapping CIDR blocks
            requester_cidr = peering['RequesterVpcInfo']['CidrBlock']
            accepter_cidr = peering['AccepterVpcInfo']['CidrBlock']
            
            req_network = ipaddress.ip_network(requester_cidr)
            acc_network = ipaddress.ip_network(accepter_cidr)
            
            assert not req_network.overlaps(acc_network), \
                f"Overlapping CIDR blocks in peering {peering_id}"

    def test_flow_logs_configuration(self):
        """Test VPC Flow Logs are enabled and configured"""
        ec2 = boto3.client('ec2')
        
        # Get all VPCs
        vpcs = ec2.describe_vpcs()
        
        for vpc in vpcs['Vpcs']:
            if vpc.get('IsDefault'):
                continue
                
            vpc_id = vpc['VpcId']
            
            # Check for flow logs
            flow_logs = ec2.describe_flow_logs(
                Filters=[
                    {'Name': 'resource-id', 'Values': [vpc_id]},
                    {'Name': 'flow-log-status', 'Values': ['ACTIVE']}
                ]
            )
            
            assert len(flow_logs['FlowLogs']) > 0, \
                f"No active flow logs for VPC {vpc_id}"
            
            for flow_log in flow_logs['FlowLogs']:
                # Check traffic type
                assert flow_log['TrafficType'] == 'ALL', \
                    f"Flow log {flow_log['FlowLogId']} not capturing all traffic"
                
                # Check destination
                assert flow_log.get('LogDestinationType') in ['s3', 'cloud-watch-logs'], \
                    f"Flow log {flow_log['FlowLogId']} has invalid destination"
                
                # Check format
                if flow_log.get('LogFormat'):
                    # Verify essential fields are captured
                    required_fields = [
                        'srcaddr', 'dstaddr', 'srcport', 'dstport',
                        'protocol', 'packets', 'bytes', 'action'
                    ]
                    log_format = flow_log['LogFormat']
                    for field in required_fields:
                        assert field in log_format, \
                            f"Flow log {flow_log['FlowLogId']} missing field {field}"

    def test_firewall_rule_consistency(self):
        """Test that firewall rules are consistent across resources"""
        ec2 = boto3.client('ec2')
        
        # Get all security groups
        security_groups = ec2.describe_security_groups()
        
        # Build rule database
        rule_database = {}
        
        for sg in security_groups['SecurityGroups']:
            sg_id = sg['GroupId']
            sg_name = sg['GroupName']
            
            # Analyze ingress rules
            for rule in sg['IpPermissions']:
                port = rule.get('FromPort')
                protocol = rule.get('IpProtocol')
                
                if port and protocol != '-1':
                    key = f"{protocol}:{port}"
                    
                    if key not in rule_database:
                        rule_database[key] = []
                    
                    rule_database[key].append({
                        'sg_id': sg_id,
                        'sg_name': sg_name,
                        'sources': rule.get('IpRanges', []) + rule.get('UserIdGroupPairs', [])
                    })
        
        # Check for inconsistencies
        for rule_key, instances in rule_database.items():
            if len(instances) > 1:
                # Multiple security groups use the same port/protocol
                # Verify they have consistent security posture
                sources_sets = []
                
                for instance in instances:
                    sources = set()
                    for src in instance['sources']:
                        if 'CidrIp' in src:
                            sources.add(src['CidrIp'])
                        elif 'GroupId' in src:
                            sources.add(src['GroupId'])
                    sources_sets.append(sources)
                
                # Check if there are significant differences
                if len(set(map(frozenset, sources_sets))) > 1:
                    # Different source configurations for same port
                    # This might be intentional but should be reviewed
                    print(f"Warning: Inconsistent rules for {rule_key} across security groups")

    def test_network_isolation_between_environments(self):
        """Test that different environments are properly isolated"""
        ec2 = boto3.client('ec2')
        
        # Get all VPCs
        vpcs = ec2.describe_vpcs()
        
        env_vpcs = {}
        
        for vpc in vpcs['Vpcs']:
            tags = {tag['Key']: tag['Value'] for tag in vpc.get('Tags', [])}
            env = tags.get('Environment', 'unknown')
            
            if env != 'unknown':
                env_vpcs[env] = vpc
        
        # Check isolation between environments
        environments = list(env_vpcs.keys())
        
        for i, env1 in enumerate(environments):
            for env2 in environments[i+1:]:
                vpc1 = env_vpcs[env1]
                vpc2 = env_vpcs[env2]
                
                # Check for peering connections
                peerings = ec2.describe_vpc_peering_connections(
                    Filters=[
                        {'Name': 'requester-vpc-info.vpc-id', 'Values': [vpc1['VpcId']]},
                        {'Name': 'accepter-vpc-info.vpc-id', 'Values': [vpc2['VpcId']]}
                    ]
                )
                
                # Production should not peer with dev/test
                if env1 == 'prod' or env2 == 'prod':
                    assert len(peerings['VpcPeeringConnections']) == 0, \
                        f"Production VPC peered with {env1 if env1 != 'prod' else env2}"

    def test_dns_firewall_configuration(self):
        """Test Route 53 Resolver DNS Firewall configuration"""
        route53resolver = boto3.client('route53resolver')
        
        # List firewall rule groups
        try:
            rule_groups = route53resolver.list_firewall_rule_groups()
            
            assert len(rule_groups['FirewallRuleGroups']) > 0, \
                "No DNS firewall rule groups configured"
            
            for group in rule_groups['FirewallRuleGroups']:
                group_id = group['Id']
                
                # Get rules in the group
                rules = route53resolver.list_firewall_rules(
                    FirewallRuleGroupId=group_id
                )
                
                # Check for malicious domain blocking
                has_block_rules = any(
                    rule['Action'] == 'BLOCK'
                    for rule in rules.get('FirewallRules', [])
                )
                
                assert has_block_rules, \
                    f"DNS firewall group {group['Name']} has no block rules"
                
                # Check for domain lists
                for rule in rules.get('FirewallRules', []):
                    if rule['Action'] == 'BLOCK':
                        assert rule.get('FirewallDomainListId'), \
                            f"Block rule {rule['Name']} has no domain list"
                            
        except route53resolver.exceptions.ResourceNotFoundException:
            pytest.fail("DNS Firewall not configured")

    def test_transit_gateway_configuration(self):
        """Test Transit Gateway configuration if used"""
        ec2 = boto3.client('ec2')
        
        # Check for Transit Gateways
        tgws = ec2.describe_transit_gateways()
        
        if tgws['TransitGateways']:
            for tgw in tgws['TransitGateways']:
                tgw_id = tgw['TransitGatewayId']
                
                # Check route tables
                route_tables = ec2.describe_transit_gateway_route_tables(
                    Filters=[
                        {'Name': 'transit-gateway-id', 'Values': [tgw_id]}
                    ]
                )
                
                assert len(route_tables['TransitGatewayRouteTables']) > 0, \
                    f"No route tables for Transit Gateway {tgw_id}"
                
                # Check attachments
                attachments = ec2.describe_transit_gateway_attachments(
                    Filters=[
                        {'Name': 'transit-gateway-id', 'Values': [tgw_id]}
                    ]
                )
                
                # Verify segmentation via route tables
                vpc_attachments = [a for a in attachments['TransitGatewayAttachments']
                                 if a['ResourceType'] == 'vpc']
                
                for attachment in vpc_attachments:
                    association = attachment.get('Association', {})
                    assert association.get('TransitGatewayRouteTableId'), \
                        f"Attachment {attachment['TransitGatewayAttachmentId']} not associated with route table"

    def test_endpoint_service_configuration(self):
        """Test VPC Endpoint Service configuration for private connectivity"""
        ec2 = boto3.client('ec2')
        
        # List VPC endpoints
        endpoints = ec2.describe_vpc_endpoints()
        
        required_services = [
            'com.amazonaws.region.s3',
            'com.amazonaws.region.dynamodb',
            'com.amazonaws.region.secretsmanager',
            'com.amazonaws.region.kms',
            'com.amazonaws.region.ecr.api',
            'com.amazonaws.region.ecr.dkr',
            'com.amazonaws.region.logs'
        ]
        
        configured_services = []
        
        for endpoint in endpoints['VpcEndpoints']:
            service_name = endpoint['ServiceName']
            configured_services.append(service_name)
            
            # Check endpoint policy
            if endpoint.get('PolicyDocument'):
                policy = json.loads(endpoint['PolicyDocument'])
                
                # Verify not overly permissive
                for statement in policy.get('Statement', []):
                    if statement.get('Effect') == 'Allow':
                        principal = statement.get('Principal')
                        assert principal != "*", \
                            f"VPC endpoint {endpoint['VpcEndpointId']} has overly permissive policy"
        
        # Check all required services have endpoints
        for service in required_services:
            service_pattern = service.replace('region', ec2.meta.region_name)
            assert any(service_pattern in s for s in configured_services), \
                f"Missing VPC endpoint for service {service}"

    def test_network_load_balancer_configuration(self):
        """Test Network Load Balancer security configuration"""
        elbv2 = boto3.client('elbv2')
        
        nlbs = elbv2.describe_load_balancers(
            PageSize=400  # Get all in one call
        )
        
        network_lbs = [lb for lb in nlbs['LoadBalancers'] if lb['Type'] == 'network']
        
        for nlb in network_lbs:
            lb_arn = nlb['LoadBalancerArn']
            lb_name = nlb['LoadBalancerName']
            
            # Check if it's internal or internet-facing
            if nlb['Scheme'] == 'internet-facing':
                # Should be in public subnets only
                subnet_ids = nlb['AvailabilityZones']
                
                for az in subnet_ids:
                    subnet_id = az['SubnetId']
                    subnet = ec2.describe_subnets(SubnetIds=[subnet_id])['Subnets'][0]
                    
                    # Check if subnet has route to IGW
                    route_table = ec2.describe_route_tables(
                        Filters=[
                            {'Name': 'association.subnet-id', 'Values': [subnet_id]}
                        ]
                    )
                    
                    if route_table['RouteTables']:
                        routes = route_table['RouteTables'][0]['Routes']
                        has_igw = any(
                            'GatewayId' in route and route['GatewayId'].startswith('igw-')
                            for route in routes
                        )
                        assert has_igw, f"NLB {lb_name} in subnet without IGW access"
            
            # Check target groups
            target_groups = elbv2.describe_target_groups(
                LoadBalancerArn=lb_arn
            )
            
            for tg in target_groups['TargetGroups']:
                # Check deregistration delay (for connection draining)
                attrs = elbv2.describe_target_group_attributes(
                    TargetGroupArn=tg['TargetGroupArn']
                )
                
                deregistration_delay = next(
                    (a['Value'] for a in attrs['Attributes']
                     if a['Key'] == 'deregistration_delay.timeout_seconds'),
                    None
                )
                
                if deregistration_delay:
                    assert int(deregistration_delay) <= 300, \
                        f"Target group {tg['TargetGroupName']} has excessive deregistration delay"