"""
Test Suite: Container Orchestration and Autoscaling
Target: Kubernetes/EKS container orchestration for SVOA Lea platform
Status: All tests should FAIL initially (TDD approach)
"""

import pytest
import yaml
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
import boto3
from kubernetes import client, config
from datetime import datetime, timedelta
import requests
from unittest.mock import Mock, patch


class TestContainerOrchestration:
    """
    Tests for container orchestration, autoscaling, and Kubernetes configurations.
    Validates EKS cluster setup, pod scaling, and resource management.
    """

    @pytest.fixture
    def scaling_requirements(self) -> Dict[str, Any]:
        """Autoscaling requirements and thresholds"""
        return {
            "min_replicas": 2,
            "max_replicas": 100,
            "target_cpu_utilization": 70,
            "target_memory_utilization": 80,
            "scale_up_rate": 100,  # percent increase per minute
            "scale_down_rate": 10,  # percent decrease per minute
            "scale_down_delay_seconds": 300,
            "pod_startup_time_seconds": 30,
            "request_rate_threshold": 1000  # requests per second
        }

    @pytest.fixture
    def resource_requirements(self) -> Dict[str, Any]:
        """Container resource requirements"""
        return {
            "api": {
                "requests": {"cpu": "100m", "memory": "128Mi"},
                "limits": {"cpu": "1000m", "memory": "1Gi"}
            },
            "worker": {
                "requests": {"cpu": "200m", "memory": "256Mi"},
                "limits": {"cpu": "2000m", "memory": "2Gi"}
            },
            "database": {
                "requests": {"cpu": "500m", "memory": "1Gi"},
                "limits": {"cpu": "4000m", "memory": "8Gi"}
            }
        }

    def test_eks_cluster_configuration(self):
        """Test EKS cluster configuration"""
        eks = boto3.client('eks')
        
        # List clusters
        clusters = eks.list_clusters()
        
        assert len(clusters['clusters']) > 0, "No EKS clusters found"
        
        for cluster_name in clusters['clusters']:
            # Get cluster details
            cluster = eks.describe_cluster(name=cluster_name)['cluster']
            
            # Check cluster status
            assert cluster['status'] == 'ACTIVE', \
                f"Cluster {cluster_name} is not active: {cluster['status']}"
            
            # Check Kubernetes version
            version = cluster['version']
            major, minor = version.split('.')[:2]
            
            # Ensure not using EOL version
            assert float(f"{major}.{minor}") >= 1.27, \
                f"Cluster {cluster_name} using outdated Kubernetes version {version}"
            
            # Check networking
            vpc_config = cluster.get('resourcesVpcConfig', {})
            
            # Check for private endpoint
            assert vpc_config.get('endpointPrivateAccess'), \
                f"Cluster {cluster_name} private endpoint not enabled"
            
            # Check for security groups
            assert vpc_config.get('securityGroupIds'), \
                f"Cluster {cluster_name} missing security groups"
            
            # Check subnets (should be multi-AZ)
            subnets = vpc_config.get('subnetIds', [])
            assert len(subnets) >= 2, \
                f"Cluster {cluster_name} not deployed across multiple AZs"
            
            # Check encryption
            encryption = cluster.get('encryptionConfig', [])
            assert len(encryption) > 0, \
                f"Cluster {cluster_name} encryption not configured"
            
            for enc_config in encryption:
                assert enc_config.get('provider', {}).get('keyArn'), \
                    f"Cluster {cluster_name} not using KMS encryption"
            
            # Check logging
            logging = cluster.get('logging', {})
            log_types = logging.get('clusterLogging', [])
            
            enabled_logs = [
                log['types'] for log in log_types
                if log.get('enabled')
            ]
            
            required_logs = ['api', 'audit', 'authenticator', 'controllerManager', 'scheduler']
            for log_type in required_logs:
                assert any(log_type in logs for logs in enabled_logs), \
                    f"Cluster {cluster_name} not logging {log_type}"

    def test_node_groups_configuration(self):
        """Test EKS node groups configuration"""
        eks = boto3.client('eks')
        
        clusters = eks.list_clusters()['clusters']
        
        for cluster_name in clusters:
            # List node groups
            node_groups = eks.list_nodegroups(clusterName=cluster_name)['nodegroups']
            
            assert len(node_groups) > 0, \
                f"Cluster {cluster_name} has no node groups"
            
            for ng_name in node_groups:
                # Get node group details
                ng = eks.describe_nodegroup(
                    clusterName=cluster_name,
                    nodegroupName=ng_name
                )['nodegroup']
                
                # Check status
                assert ng['status'] == 'ACTIVE', \
                    f"Node group {ng_name} is not active"
                
                # Check scaling configuration
                scaling_config = ng.get('scalingConfig', {})
                
                assert scaling_config.get('minSize', 0) >= 2, \
                    f"Node group {ng_name} min size less than 2"
                assert scaling_config.get('desiredSize', 0) >= 2, \
                    f"Node group {ng_name} desired size less than 2"
                assert scaling_config.get('maxSize', 0) >= 4, \
                    f"Node group {ng_name} max size less than 4"
                
                # Check instance types
                instance_types = ng.get('instanceTypes', [])
                assert len(instance_types) > 0, \
                    f"Node group {ng_name} has no instance types"
                
                # Verify instance types are appropriate
                for instance_type in instance_types:
                    # Check for EU-optimized instances
                    assert not instance_type.startswith('t2.'), \
                        f"Node group {ng_name} using legacy t2 instances"
                
                # Check subnets (multi-AZ)
                subnets = ng.get('subnets', [])
                assert len(subnets) >= 2, \
                    f"Node group {ng_name} not distributed across AZs"
                
                # Check AMI type
                ami_type = ng.get('amiType')
                assert ami_type in ['AL2_x86_64', 'AL2_x86_64_GPU', 'AL2_ARM_64'], \
                    f"Node group {ng_name} using unsupported AMI type {ami_type}"
                
                # Check tags
                tags = ng.get('tags', {})
                assert 'Environment' in tags, \
                    f"Node group {ng_name} missing Environment tag"
                assert 'Team' in tags, \
                    f"Node group {ng_name} missing Team tag"

    def test_horizontal_pod_autoscaler(self, scaling_requirements: Dict[str, Any]):
        """Test HPA configurations"""
        # This would connect to K8s cluster in real environment
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        hpa_files = list(k8s_dir.glob("**/hpa*.yaml")) + \
                   list(k8s_dir.glob("**/*hpa.yaml"))
        
        assert len(hpa_files) > 0, "No HPA configurations found"
        
        for hpa_file in hpa_files:
            with open(hpa_file, 'r') as f:
                hpa = yaml.safe_load(f)
            
            if hpa.get('kind') == 'HorizontalPodAutoscaler':
                spec = hpa.get('spec', {})
                
                # Check min/max replicas
                min_replicas = spec.get('minReplicas', 1)
                max_replicas = spec.get('maxReplicas', 1)
                
                assert min_replicas >= scaling_requirements['min_replicas'], \
                    f"HPA {hpa_file.name} min replicas below requirement"
                assert max_replicas <= scaling_requirements['max_replicas'], \
                    f"HPA {hpa_file.name} max replicas exceeds limit"
                assert max_replicas > min_replicas, \
                    f"HPA {hpa_file.name} max replicas not greater than min"
                
                # Check metrics
                metrics = spec.get('metrics', [])
                assert len(metrics) > 0, f"HPA {hpa_file.name} has no metrics"
                
                # Check for CPU metric
                cpu_metric = next(
                    (m for m in metrics if m.get('type') == 'Resource' and
                     m.get('resource', {}).get('name') == 'cpu'),
                    None
                )
                
                if cpu_metric:
                    target = cpu_metric['resource'].get('target', {})
                    utilization = target.get('averageUtilization')
                    
                    assert utilization == scaling_requirements['target_cpu_utilization'], \
                        f"HPA {hpa_file.name} CPU target {utilization}% != {scaling_requirements['target_cpu_utilization']}%"
                
                # Check behavior (v2 API)
                behavior = spec.get('behavior', {})
                if behavior:
                    # Check scale up behavior
                    scale_up = behavior.get('scaleUp', {})
                    if scale_up:
                        policies = scale_up.get('policies', [])
                        assert len(policies) > 0, \
                            f"HPA {hpa_file.name} has no scale up policies"
                    
                    # Check scale down behavior
                    scale_down = behavior.get('scaleDown', {})
                    if scale_down:
                        stabilization = scale_down.get('stabilizationWindowSeconds', 0)
                        assert stabilization >= scaling_requirements['scale_down_delay_seconds'], \
                            f"HPA {hpa_file.name} scale down stabilization too short"

    def test_vertical_pod_autoscaler(self):
        """Test VPA configurations if used"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        vpa_files = list(k8s_dir.glob("**/vpa*.yaml"))
        
        if not vpa_files:
            return  # VPA is optional
        
        for vpa_file in vpa_files:
            with open(vpa_file, 'r') as f:
                vpa = yaml.safe_load(f)
            
            if vpa.get('kind') == 'VerticalPodAutoscaler':
                spec = vpa.get('spec', {})
                
                # Check update policy
                update_policy = spec.get('updatePolicy', {})
                update_mode = update_policy.get('updateMode', 'Off')
                
                assert update_mode in ['Off', 'Initial', 'Auto'], \
                    f"VPA {vpa_file.name} has invalid update mode {update_mode}"
                
                # Check resource policy
                resource_policy = spec.get('resourcePolicy', {})
                container_policies = resource_policy.get('containerPolicies', [])
                
                for policy in container_policies:
                    # Check for min/max allowed resources
                    assert 'minAllowed' in policy, \
                        f"VPA {vpa_file.name} missing minAllowed resources"
                    assert 'maxAllowed' in policy, \
                        f"VPA {vpa_file.name} missing maxAllowed resources"

    def test_cluster_autoscaler(self):
        """Test cluster autoscaler configuration"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        # Check for cluster autoscaler deployment
        ca_files = list(k8s_dir.glob("**/cluster-autoscaler*.yaml"))
        
        assert len(ca_files) > 0, "Cluster autoscaler not configured"
        
        for ca_file in ca_files:
            with open(ca_file, 'r') as f:
                docs = yaml.safe_load_all(f)
                
                for doc in docs:
                    if not doc:
                        continue
                        
                    if doc.get('kind') == 'Deployment':
                        spec = doc.get('spec', {})
                        template = spec.get('template', {})
                        pod_spec = template.get('spec', {})
                        
                        # Check for proper node selector
                        node_selector = pod_spec.get('nodeSelector', {})
                        assert node_selector, \
                            "Cluster autoscaler not pinned to specific nodes"
                        
                        # Check containers
                        containers = pod_spec.get('containers', [])
                        
                        for container in containers:
                            if 'cluster-autoscaler' in container.get('image', ''):
                                # Check command arguments
                                args = container.get('command', []) + container.get('args', [])
                                
                                # Check for required flags
                                required_flags = [
                                    '--balance-similar-node-groups',
                                    '--skip-nodes-with-system-pods=false',
                                    '--scale-down-delay-after-add'
                                ]
                                
                                args_str = ' '.join(args)
                                for flag in required_flags:
                                    flag_name = flag.split('=')[0]
                                    assert flag_name in args_str, \
                                        f"Cluster autoscaler missing flag {flag_name}"
                                
                                # Check resource limits
                                resources = container.get('resources', {})
                                assert 'limits' in resources, \
                                    "Cluster autoscaler missing resource limits"
                                assert 'requests' in resources, \
                                    "Cluster autoscaler missing resource requests"

    def test_pod_disruption_budgets(self):
        """Test PodDisruptionBudget configurations"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        pdb_files = list(k8s_dir.glob("**/pdb*.yaml")) + \
                   list(k8s_dir.glob("**/*pdb.yaml"))
        
        # Also check for PDBs in deployment files
        deployment_files = list(k8s_dir.glob("**/deployment*.yaml"))
        
        pdbs = []
        for file in pdb_files + deployment_files:
            with open(file, 'r') as f:
                docs = yaml.safe_load_all(f)
                
                for doc in docs:
                    if doc and doc.get('kind') == 'PodDisruptionBudget':
                        pdbs.append((file, doc))
        
        assert len(pdbs) > 0, "No PodDisruptionBudgets configured"
        
        for file, pdb in pdbs:
            spec = pdb.get('spec', {})
            
            # Check for either minAvailable or maxUnavailable
            has_min = 'minAvailable' in spec
            has_max = 'maxUnavailable' in spec
            
            assert has_min or has_max, \
                f"PDB in {file.name} lacks availability configuration"
            
            # Check selector
            assert 'selector' in spec, \
                f"PDB in {file.name} lacks pod selector"
            
            # Verify reasonable values
            if has_min:
                min_available = spec['minAvailable']
                if isinstance(min_available, int):
                    assert min_available >= 1, \
                        f"PDB in {file.name} minAvailable too low"
            
            if has_max:
                max_unavailable = spec['maxUnavailable']
                if isinstance(max_unavailable, int):
                    assert max_unavailable >= 1, \
                        f"PDB in {file.name} maxUnavailable is 0"

    def test_resource_quotas(self):
        """Test namespace resource quotas"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        quota_files = list(k8s_dir.glob("**/quota*.yaml")) + \
                     list(k8s_dir.glob("**/resourcequota*.yaml"))
        
        namespaces = set()
        quotas = []
        
        # Find all namespaces
        ns_files = list(k8s_dir.glob("**/namespace*.yaml"))
        for ns_file in ns_files:
            with open(ns_file, 'r') as f:
                ns = yaml.safe_load(f)
                if ns.get('kind') == 'Namespace':
                    namespaces.add(ns['metadata']['name'])
        
        # Check quotas
        for quota_file in quota_files:
            with open(quota_file, 'r') as f:
                quota = yaml.safe_load(f)
                
                if quota.get('kind') == 'ResourceQuota':
                    quotas.append(quota)
                    spec = quota.get('spec', {})
                    
                    # Check hard limits
                    hard = spec.get('hard', {})
                    
                    required_limits = [
                        'requests.cpu',
                        'requests.memory',
                        'limits.cpu',
                        'limits.memory',
                        'persistentvolumeclaims'
                    ]
                    
                    for limit in required_limits:
                        assert limit in hard, \
                            f"ResourceQuota in {quota_file.name} missing {limit}"
                    
                    # Check scope selectors for priority classes
                    scope_selector = spec.get('scopeSelector', {})
                    if scope_selector:
                        match_expressions = scope_selector.get('matchExpressions', [])
                        
                        # Should have priority-based quotas
                        priority_scopes = [
                            expr for expr in match_expressions
                            if expr.get('scopeName') == 'PriorityClass'
                        ]
                        
                        if priority_scopes:
                            assert len(priority_scopes) > 0, \
                                "Priority-based quotas not configured"
        
        # Ensure critical namespaces have quotas
        critical_namespaces = ['production', 'staging', 'default']
        for ns in critical_namespaces:
            if ns in namespaces:
                ns_quotas = [
                    q for q in quotas
                    if q['metadata'].get('namespace') == ns
                ]
                assert len(ns_quotas) > 0, \
                    f"Critical namespace {ns} lacks resource quota"

    def test_container_resource_limits(self, resource_requirements: Dict[str, Any]):
        """Test container resource requests and limits"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        deployment_files = list(k8s_dir.glob("**/deployment*.yaml")) + \
                          list(k8s_dir.glob("**/statefulset*.yaml")) + \
                          list(k8s_dir.glob("**/daemonset*.yaml"))
        
        for file in deployment_files:
            with open(file, 'r') as f:
                manifest = yaml.safe_load(f)
            
            if manifest.get('kind') in ['Deployment', 'StatefulSet', 'DaemonSet']:
                spec = manifest.get('spec', {})
                template = spec.get('template', {})
                pod_spec = template.get('spec', {})
                containers = pod_spec.get('containers', [])
                
                for container in containers:
                    name = container.get('name', 'unknown')
                    resources = container.get('resources', {})
                    
                    # Check for resource requests
                    assert 'requests' in resources, \
                        f"Container {name} in {file.name} missing resource requests"
                    
                    requests = resources['requests']
                    assert 'cpu' in requests, \
                        f"Container {name} in {file.name} missing CPU request"
                    assert 'memory' in requests, \
                        f"Container {name} in {file.name} missing memory request"
                    
                    # Check for resource limits
                    assert 'limits' in resources, \
                        f"Container {name} in {file.name} missing resource limits"
                    
                    limits = resources['limits']
                    assert 'cpu' in limits, \
                        f"Container {name} in {file.name} missing CPU limit"
                    assert 'memory' in limits, \
                        f"Container {name} in {file.name} missing memory limit"
                    
                    # Verify limits are greater than requests
                    cpu_request = self._parse_cpu(requests['cpu'])
                    cpu_limit = self._parse_cpu(limits['cpu'])
                    assert cpu_limit >= cpu_request, \
                        f"Container {name} CPU limit less than request"
                    
                    mem_request = self._parse_memory(requests['memory'])
                    mem_limit = self._parse_memory(limits['memory'])
                    assert mem_limit >= mem_request, \
                        f"Container {name} memory limit less than request"

    def test_init_containers(self):
        """Test init container configurations"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        deployment_files = list(k8s_dir.glob("**/deployment*.yaml")) + \
                          list(k8s_dir.glob("**/statefulset*.yaml"))
        
        for file in deployment_files:
            with open(file, 'r') as f:
                manifest = yaml.safe_load(f)
            
            if manifest.get('kind') in ['Deployment', 'StatefulSet']:
                spec = manifest.get('spec', {})
                template = spec.get('template', {})
                pod_spec = template.get('spec', {})
                init_containers = pod_spec.get('initContainers', [])
                
                for init_container in init_containers:
                    name = init_container.get('name', 'unknown')
                    
                    # Check resources
                    resources = init_container.get('resources', {})
                    assert resources, \
                        f"Init container {name} in {file.name} missing resources"
                    
                    # Check image
                    image = init_container.get('image', '')
                    assert image, \
                        f"Init container {name} in {file.name} missing image"
                    
                    # Check for command or args
                    has_command = 'command' in init_container or 'args' in init_container
                    assert has_command, \
                        f"Init container {name} in {file.name} missing command/args"

    def test_statefulset_configuration(self):
        """Test StatefulSet specific configurations"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        statefulset_files = list(k8s_dir.glob("**/statefulset*.yaml"))
        
        for file in statefulset_files:
            with open(file, 'r') as f:
                sts = yaml.safe_load(f)
            
            if sts.get('kind') == 'StatefulSet':
                spec = sts.get('spec', {})
                
                # Check service name
                assert 'serviceName' in spec, \
                    f"StatefulSet in {file.name} missing serviceName"
                
                # Check volume claim templates for persistent storage
                volume_claims = spec.get('volumeClaimTemplates', [])
                if volume_claims:
                    for claim in volume_claims:
                        claim_spec = claim.get('spec', {})
                        
                        # Check access modes
                        access_modes = claim_spec.get('accessModes', [])
                        assert 'ReadWriteOnce' in access_modes, \
                            f"StatefulSet in {file.name} PVC missing ReadWriteOnce"
                        
                        # Check storage class
                        assert 'storageClassName' in claim_spec, \
                            f"StatefulSet in {file.name} PVC missing storage class"
                        
                        # Check resources
                        resources = claim_spec.get('resources', {})
                        requests = resources.get('requests', {})
                        assert 'storage' in requests, \
                            f"StatefulSet in {file.name} PVC missing storage request"
                
                # Check update strategy
                update_strategy = spec.get('updateStrategy', {})
                assert update_strategy.get('type') in ['RollingUpdate', 'OnDelete'], \
                    f"StatefulSet in {file.name} has invalid update strategy"
                
                # Check pod management policy
                pod_policy = spec.get('podManagementPolicy', 'OrderedReady')
                assert pod_policy in ['OrderedReady', 'Parallel'], \
                    f"StatefulSet in {file.name} has invalid pod management policy"

    def test_service_mesh_configuration(self):
        """Test service mesh (Istio/Linkerd) configuration if present"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        # Check for Istio configurations
        istio_files = list(k8s_dir.glob("**/virtualservice*.yaml")) + \
                     list(k8s_dir.glob("**/destinationrule*.yaml")) + \
                     list(k8s_dir.glob("**/gateway*.yaml"))
        
        if istio_files:
            for file in istio_files:
                with open(file, 'r') as f:
                    resource = yaml.safe_load(f)
                
                kind = resource.get('kind')
                
                if kind == 'VirtualService':
                    spec = resource.get('spec', {})
                    
                    # Check hosts
                    assert 'hosts' in spec, \
                        f"VirtualService in {file.name} missing hosts"
                    
                    # Check HTTP routes
                    http = spec.get('http', [])
                    for route in http:
                        # Check timeout
                        assert 'timeout' in route, \
                            f"VirtualService in {file.name} route missing timeout"
                        
                        # Check retry policy
                        if 'retries' in route:
                            retries = route['retries']
                            assert 'attempts' in retries, \
                                "Retry policy missing attempts"
                            assert 'perTryTimeout' in retries, \
                                "Retry policy missing perTryTimeout"
                
                elif kind == 'DestinationRule':
                    spec = resource.get('spec', {})
                    
                    # Check traffic policy
                    traffic_policy = spec.get('trafficPolicy', {})
                    
                    # Check circuit breaker
                    if 'connectionPool' in traffic_policy:
                        tcp = traffic_policy['connectionPool'].get('tcp', {})
                        assert 'maxConnections' in tcp, \
                            f"DestinationRule in {file.name} missing max connections"
                    
                    # Check load balancer
                    if 'loadBalancer' in traffic_policy:
                        lb = traffic_policy['loadBalancer']
                        assert 'simple' in lb or 'consistentHash' in lb, \
                            f"DestinationRule in {file.name} missing LB config"

    def test_pod_priority_classes(self):
        """Test pod priority class configurations"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        
        if not k8s_dir.exists():
            pytest.skip("Kubernetes manifests not found")
        
        # Check for priority classes
        priority_files = list(k8s_dir.glob("**/priorityclass*.yaml"))
        
        if priority_files:
            priority_classes = {}
            
            for file in priority_files:
                with open(file, 'r') as f:
                    pc = yaml.safe_load(f)
                
                if pc.get('kind') == 'PriorityClass':
                    name = pc['metadata']['name']
                    value = pc.get('value')
                    
                    assert value is not None, \
                        f"PriorityClass {name} missing value"
                    
                    priority_classes[name] = value
                    
                    # Check for preemption policy
                    assert 'preemptionPolicy' in pc, \
                        f"PriorityClass {name} missing preemption policy"
            
            # Verify priority hierarchy
            assert len(priority_classes) >= 3, \
                "Insufficient priority classes for workload differentiation"
            
            # Check for standard priorities
            expected_priorities = ['high', 'medium', 'low']
            for expected in expected_priorities:
                assert any(expected in name.lower() for name in priority_classes), \
                    f"Missing {expected} priority class"

    def test_karpenter_configuration(self):
        """Test Karpenter autoscaler configuration if used"""
        k8s_dir = Path("kubernetes") or Path("k8s")
        karpenter_dir = k8s_dir / "karpenter" if k8s_dir.exists() else None
        
        if not karpenter_dir or not karpenter_dir.exists():
            return  # Karpenter is optional
        
        provisioner_files = list(karpenter_dir.glob("**/provisioner*.yaml"))
        
        for file in provisioner_files:
            with open(file, 'r') as f:
                provisioner = yaml.safe_load(f)
            
            if provisioner.get('kind') == 'Provisioner':
                spec = provisioner.get('spec', {})
                
                # Check requirements
                requirements = spec.get('requirements', [])
                
                # Check for instance family requirements
                instance_req = next(
                    (req for req in requirements if req['key'] == 'karpenter.sh/instance-family'),
                    None
                )
                
                if instance_req:
                    # Verify EU-optimized instances
                    families = instance_req.get('values', [])
                    assert len(families) > 0, \
                        f"Provisioner in {file.name} has no instance families"
                
                # Check limits
                limits = spec.get('limits', {})
                assert 'resources' in limits, \
                    f"Provisioner in {file.name} missing resource limits"
                
                # Check TTL settings
                ttl_settings = spec.get('ttlSecondsAfterEmpty')
                assert ttl_settings is not None, \
                    f"Provisioner in {file.name} missing TTL configuration"

    # Helper methods
    def _parse_cpu(self, cpu_str: str) -> float:
        """Parse CPU resource string to millicores"""
        if cpu_str.endswith('m'):
            return float(cpu_str[:-1])
        return float(cpu_str) * 1000
    
    def _parse_memory(self, mem_str: str) -> int:
        """Parse memory resource string to bytes"""
        units = {
            'Ki': 1024,
            'Mi': 1024**2,
            'Gi': 1024**3,
            'K': 1000,
            'M': 1000**2,
            'G': 1000**3
        }
        
        for unit, multiplier in units.items():
            if mem_str.endswith(unit):
                return int(float(mem_str[:-len(unit)]) * multiplier)
        
        return int(mem_str)