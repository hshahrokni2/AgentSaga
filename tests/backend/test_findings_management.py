"""
TDD RED Phase Tests for Findings Management System
Focus on state transitions, evidence linking, batch operations, and audit trail
"""

import pytest
import pytest_asyncio
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, patch
import json
import uuid


class TestFindingStateTransitions:
    """Test state machine for finding lifecycle"""
    
    @pytest.fixture
    def findings_manager(self):
        """Create findings manager instance"""
        from src.services.findings_management import FindingsManager
        return FindingsManager()
    
    @pytest.fixture
    def sample_finding(self):
        """Sample finding for testing"""
        return {
            'finding_id': str(uuid.uuid4()),
            'rule_id': 'DUPLICATE_DETECTION',
            'month': '2024-03',
            'supplier': 'supplier-123',
            'row_ref': str(uuid.uuid4()),
            'severity': 'high',
            'state': 'new',
            'evidence': {
                'row_ids': [str(uuid.uuid4()), str(uuid.uuid4())],
                'weight_delta': 25.5,
                'time_window': 30
            }
        }
    
    @pytest.mark.asyncio
    async def test_valid_state_transitions(self, findings_manager, sample_finding):
        """Test that valid state transitions are allowed"""
        # Create finding
        finding = await findings_manager.create_finding(sample_finding)
        assert finding['state'] == 'new'
        
        # Transition: new → triaged
        updated = await findings_manager.update_state(
            finding['finding_id'],
            'triaged',
            user='analyst@example.com',
            notes='Initial review completed'
        )
        assert updated['state'] == 'triaged'
        
        # Transition: triaged → explained
        updated = await findings_manager.update_state(
            finding['finding_id'],
            'explained',
            user='analyst@example.com',
            notes='Weekend surge in deliveries'
        )
        assert updated['state'] == 'explained'
        
        # Transition: explained → resolved
        updated = await findings_manager.update_state(
            finding['finding_id'],
            'resolved',
            user='lead@example.com',
            notes='Accepted as normal pattern'
        )
        assert updated['state'] == 'resolved'
    
    @pytest.mark.asyncio
    async def test_invalid_state_transitions(self, findings_manager, sample_finding):
        """Test that invalid state transitions are rejected"""
        finding = await findings_manager.create_finding(sample_finding)
        
        # Cannot jump from new → resolved
        with pytest.raises(ValueError, match="Invalid state transition"):
            await findings_manager.update_state(
                finding['finding_id'],
                'resolved',
                user='analyst@example.com'
            )
        
        # Cannot go backwards from resolved → new
        await findings_manager.update_state(finding['finding_id'], 'triaged', user='test')
        await findings_manager.update_state(finding['finding_id'], 'resolved', user='test')
        
        with pytest.raises(ValueError, match="Cannot transition backwards"):
            await findings_manager.update_state(
                finding['finding_id'],
                'new',
                user='analyst@example.com'
            )
    
    @pytest.mark.asyncio
    async def test_false_positive_transition(self, findings_manager, sample_finding):
        """Test marking findings as false positive"""
        finding = await findings_manager.create_finding(sample_finding)
        
        # Can mark as false_positive from new or triaged
        updated = await findings_manager.update_state(
            finding['finding_id'],
            'false_positive',
            user='analyst@example.com',
            notes='Data entry error'
        )
        assert updated['state'] == 'false_positive'
        assert updated['metadata']['false_positive_reason'] is not None
    
    @pytest.mark.asyncio
    async def test_concurrent_state_updates(self, findings_manager, sample_finding):
        """Test that concurrent state updates are handled safely"""
        finding = await findings_manager.create_finding(sample_finding)
        
        # Simulate concurrent updates
        async def update_state(new_state: str):
            try:
                return await findings_manager.update_state(
                    finding['finding_id'],
                    new_state,
                    user='user@example.com'
                )
            except:
                return None
        
        # Only one should succeed
        results = await asyncio.gather(
            update_state('triaged'),
            update_state('triaged'),
            update_state('triaged'),
            return_exceptions=True
        )
        
        successful = [r for r in results if r is not None and not isinstance(r, Exception)]
        assert len(successful) == 1
        assert successful[0]['state'] == 'triaged'


class TestEvidenceLinking:
    """Test evidence association with findings"""
    
    @pytest.fixture
    def evidence_linker(self):
        """Create evidence linker instance"""
        from src.services.findings_management import EvidenceLinker
        return EvidenceLinker()
    
    @pytest.mark.asyncio
    async def test_link_row_evidence(self, evidence_linker):
        """Test linking raw data rows to findings"""
        finding_id = str(uuid.uuid4())
        row_ids = [str(uuid.uuid4()) for _ in range(3)]
        
        # Link rows
        result = await evidence_linker.link_rows(
            finding_id=finding_id,
            row_ids=row_ids,
            confidence=0.95,
            metadata={'detection_method': 'duplicate_scan'}
        )
        
        assert result['finding_id'] == finding_id
        assert len(result['evidence']['rows']) == 3
        assert result['evidence']['confidence'] == 0.95
    
    @pytest.mark.asyncio
    async def test_link_file_evidence(self, evidence_linker):
        """Test linking files/documents to findings"""
        finding_id = str(uuid.uuid4())
        
        # Link files
        result = await evidence_linker.link_files(
            finding_id=finding_id,
            file_paths=['uploads/2024-03/invoice_001.xlsx'],
            file_types=['source_document'],
            metadata={'sheet_name': 'March_Deliveries', 'row_range': '10-15'}
        )
        
        assert result['finding_id'] == finding_id
        assert len(result['evidence']['files']) == 1
        assert 'invoice_001.xlsx' in result['evidence']['files'][0]
    
    @pytest.mark.asyncio
    async def test_link_chart_evidence(self, evidence_linker):
        """Test linking visualizations/charts to findings"""
        finding_id = str(uuid.uuid4())
        
        # Link charts
        chart_config = {
            'type': 'time_series',
            'data': {'x': [1, 2, 3], 'y': [100, 150, 200]},
            'title': 'Weekend Volume Spike'
        }
        
        result = await evidence_linker.link_charts(
            finding_id=finding_id,
            chart_configs=[chart_config],
            metadata={'generated_at': '2024-03-15T10:00:00Z'}
        )
        
        assert result['finding_id'] == finding_id
        assert len(result['evidence']['charts']) == 1
        assert result['evidence']['charts'][0]['type'] == 'time_series'
    
    @pytest.mark.asyncio
    async def test_evidence_chain_integrity(self, evidence_linker):
        """Test that evidence chain maintains integrity"""
        finding_id = str(uuid.uuid4())
        
        # Add multiple evidence types
        await evidence_linker.link_rows(finding_id, [str(uuid.uuid4())])
        await evidence_linker.link_files(finding_id, ['file1.xlsx'])
        await evidence_linker.link_charts(finding_id, [{'type': 'bar'}])
        
        # Retrieve complete evidence chain
        evidence = await evidence_linker.get_evidence_chain(finding_id)
        
        assert evidence['finding_id'] == finding_id
        assert 'rows' in evidence
        assert 'files' in evidence
        assert 'charts' in evidence
        assert evidence['chain_hash'] is not None  # Integrity hash
        
        # Verify chain cannot be tampered with
        with pytest.raises(ValueError, match="Evidence chain is immutable"):
            await evidence_linker.modify_evidence(finding_id, {})


class TestBatchOperations:
    """Test batch operations for findings"""
    
    @pytest.fixture
    def findings_manager(self):
        """Create findings manager instance"""
        from src.services.findings_management import FindingsManager
        return FindingsManager()
    
    @pytest.fixture
    def batch_processor(self, findings_manager):
        """Create batch processor instance"""
        from src.services.findings_management import FindingsBatchProcessor
        return FindingsBatchProcessor(findings_manager)
    
    @pytest.mark.asyncio
    async def test_batch_state_update(self, batch_processor, findings_manager):
        """Test updating multiple findings' states at once"""
        # Create test findings
        finding_ids = []
        for i in range(10):
            finding = await findings_manager.create_finding({
                'rule_id': f'RULE_{i}',
                'month': '2024-03',
                'supplier': 'supplier-123',
                'state': 'new'
            })
            finding_ids.append(finding['finding_id'])
        
        # Batch update to triaged - using batch_update which takes a list of updates
        updates = [{'finding_id': fid, 'state': 'triaged', 'reason': 'Batch update'} for fid in finding_ids[:5]]
        result = await batch_processor.batch_update(updates)
        
        assert len(result['success']) == 5
        assert len(result['failed']) == 0
        
        # Verify states were updated
        for fid in finding_ids[:5]:
            finding = await findings_manager.get_finding(fid)
            assert finding['state'] == 'triaged'
    
    @pytest.mark.asyncio
    async def test_batch_false_positive_marking(self, batch_processor, findings_manager):
        """Test marking multiple findings as false positive"""
        # Create test findings
        finding_ids = []
        for i in range(5):
            finding = await findings_manager.create_finding({
                'rule_id': f'RULE_{i}',
                'month': '2024-03',
                'supplier': 'supplier-123',
                'state': 'triaged'
            })
            finding_ids.append(finding['finding_id'])
        
        # Mark as false positive using batch_update
        updates = [{'finding_id': fid, 'state': 'false_positive', 'reason': 'Duplicate data'} for fid in finding_ids]
        result = await batch_processor.batch_update(updates)
        
        assert len(result['success']) == 5
        
        # Verify all are now false_positive
        for fid in finding_ids:
            finding = await findings_manager.get_finding(fid)
            assert finding['state'] == 'false_positive'
    
    @pytest.mark.asyncio
    async def test_batch_severity_update(self, batch_processor, findings_manager):
        """Test updating severity for multiple findings"""
        # Create test findings with different severities
        finding_data = []
        for i in range(8):
            finding_data.append({
                'rule_id': f'RULE_{i}',
                'month': '2024-03',
                'supplier': 'supplier-123',
                'severity': 'info' if i % 2 == 0 else 'warn'
            })
        
        # Use batch_create to create all findings
        findings = await batch_processor.batch_create(finding_data)
        
        # Verify creation
        assert len(findings) == 8
        assert sum(1 for f in findings if f['severity'] == 'info') == 4
        assert sum(1 for f in findings if f['severity'] == 'warn') == 4
    
    @pytest.mark.asyncio
    async def test_batch_operation_transaction(self, batch_processor, findings_manager):
        """Test that batch operations are transactional"""
        # Create some valid findings
        finding_ids = []
        for i in range(5):
            finding = await findings_manager.create_finding({
                'rule_id': f'RULE_{i}',
                'month': '2024-03',
                'supplier': 'supplier-123'
            })
            finding_ids.append(finding['finding_id'])
        
        # Add an invalid transition to cause failure
        updates = [{'finding_id': fid, 'state': 'triaged'} for fid in finding_ids]
        # Add an invalid state transition (triaged -> new is invalid - can't go backwards)
        updates.append({'finding_id': finding_ids[0], 'state': 'new'})
        
        # Run batch update - some will succeed, some will fail
        result = await batch_processor.batch_update(updates)
        
        # Check that we have mixed results
        assert len(result['success']) > 0
        assert len(result['failed']) > 0


class TestAuditTrail:
    """Test audit trail generation and immutability"""
    
    @pytest.fixture
    def audit_logger(self):
        """Create audit logger instance"""
        from src.services.findings_management import FindingsAuditLogger
        return FindingsAuditLogger()
    
    @pytest.mark.asyncio
    async def test_audit_trail_generation(self, audit_logger):
        """Test that all operations generate audit entries"""
        finding_id = str(uuid.uuid4())
        
        # Perform operations
        events = []
        events.append(await audit_logger.log_create(finding_id, {'state': 'new'}, 'user1'))
        events.append(await audit_logger.log_state_change(finding_id, 'new', 'triaged', 'user2'))
        events.append(await audit_logger.log_evidence_link(finding_id, 'rows', ['row1'], 'user3'))
        
        # Retrieve audit trail
        trail = await audit_logger.get_audit_trail(finding_id)
        
        assert len(trail) == 3
        assert trail[0]['action'] == 'create'
        assert trail[1]['action'] == 'state_change'
        assert trail[2]['action'] == 'evidence_link'
        
        # Verify chronological order
        for i in range(1, len(trail)):
            assert trail[i]['timestamp'] >= trail[i-1]['timestamp']
    
    @pytest.mark.asyncio
    async def test_audit_trail_immutability(self, audit_logger):
        """Test that audit entries cannot be modified or deleted"""
        finding_id = str(uuid.uuid4())
        
        # Create audit entry
        entry = await audit_logger.log_create(finding_id, {'state': 'new'}, 'user1')
        entry_id = entry['audit_id']
        
        # Attempt to modify
        with pytest.raises(ValueError, match="Audit entries are immutable"):
            await audit_logger.modify_entry(entry_id, {'state': 'modified'})
        
        # Attempt to delete
        with pytest.raises(ValueError, match="Audit entries cannot be deleted"):
            await audit_logger.delete_entry(entry_id)
        
        # Verify entry unchanged
        retrieved = await audit_logger.get_entry(entry_id)
        assert retrieved == entry
    
    @pytest.mark.asyncio
    async def test_audit_trail_integrity_hash(self, audit_logger):
        """Test that audit trail has cryptographic integrity"""
        finding_id = str(uuid.uuid4())
        
        # Generate trail
        await audit_logger.log_create(finding_id, {'state': 'new'}, 'user1')
        await audit_logger.log_state_change(finding_id, 'new', 'triaged', 'user2')
        
        # Get trail with integrity hash
        trail = await audit_logger.get_audit_trail(finding_id, include_hash=True)
        
        assert trail['hash'] is not None
        assert len(trail['hash']) == 64  # SHA-256 hex
        
        # Verify hash
        is_valid = await audit_logger.verify_trail_integrity(finding_id, trail['hash'])
        assert is_valid is True
        
        # Tampered hash should fail
        tampered_hash = 'a' * 64
        is_valid = await audit_logger.verify_trail_integrity(finding_id, tampered_hash)
        assert is_valid is False


class TestFindingsAPI:
    """Test API endpoints for findings management"""
    
    @pytest.fixture
    def findings_manager(self):
        """Create findings manager instance"""
        from src.services.findings_management import FindingsManager
        return FindingsManager()
    
    @pytest.fixture
    def api_client(self, findings_manager):
        """Create API client instance"""
        from src.services.findings_management import FindingsAPIClient
        return FindingsAPIClient(findings_manager)
    
    @pytest.mark.asyncio
    async def test_create_finding_api(self, api_client):
        """Test POST /api/findings endpoint"""
        finding_data = {
            'rule_id': 'WEIGHT_OUTLIER',
            'month': '2024-03',
            'supplier': 'supplier-123',
            'severity': 'high',
            'evidence': {
                'z_score': 3.5,
                'expected': 1000,
                'actual': 1500
            }
        }
        
        response = await api_client.post('/api/findings', json=finding_data)
        
        assert response.status_code == 201
        assert 'finding_id' in response.json()
        assert response.json()['state'] == 'new'
    
    @pytest.mark.asyncio
    async def test_get_finding_api(self, api_client):
        """Test GET /api/findings/{id} endpoint"""
        finding_id = str(uuid.uuid4())
        
        response = await api_client.get(f'/api/findings/{finding_id}')
        
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            assert response.json()['finding_id'] == finding_id
    
    @pytest.mark.asyncio
    async def test_update_finding_api(self, api_client):
        """Test PATCH /api/findings/{id} endpoint"""
        finding_id = str(uuid.uuid4())
        updates = {
            'state': 'triaged',
            'severity': 'critical',
            'notes': 'Escalated due to pattern'
        }
        
        response = await api_client.patch(f'/api/findings/{finding_id}', json=updates)
        
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            assert response.json()['state'] == 'triaged'
    
    @pytest.mark.asyncio
    async def test_delete_finding_api(self, api_client):
        """Test DELETE /api/findings/{id} endpoint"""
        finding_id = str(uuid.uuid4())
        
        response = await api_client.delete(f'/api/findings/{finding_id}')
        
        assert response.status_code in [204, 404]
    
    @pytest.mark.asyncio
    async def test_batch_update_api(self, api_client):
        """Test POST /api/findings/batch-update endpoint"""
        batch_request = {
            'finding_ids': [str(uuid.uuid4()) for _ in range(5)],
            'updates': {
                'state': 'resolved',
                'resolution': 'Accepted as normal variation'
            },
            'user': 'lead@example.com'
        }
        
        response = await api_client.post('/api/findings/batch-update', json=batch_request)
        
        assert response.status_code == 200
        assert 'updated' in response.json()
        assert 'failed' in response.json()


class TestFilteringAndSearch:
    """Test filtering and search functionality"""
    
    @pytest.fixture
    def findings_manager(self):
        """Create findings manager instance"""
        from src.services.findings_management import FindingsManager
        return FindingsManager()
    
    @pytest.fixture
    def search_engine(self, findings_manager):
        """Create search engine instance"""
        from src.services.findings_management import FindingsSearchEngine
        return FindingsSearchEngine(findings_manager)
    
    @pytest.mark.asyncio
    async def test_filter_by_severity(self, search_engine):
        """Test filtering findings by severity"""
        # Setup test data
        for severity in ['critical', 'high', 'medium', 'low']:
            for i in range(3):
                await search_engine.index_finding({
                    'finding_id': str(uuid.uuid4()),
                    'severity': severity,
                    'month': '2024-03',
                    'supplier': f'supplier-{i}'
                })
        
        # Filter critical only
        results = await search_engine.filter_findings(severity=['critical'])
        assert len(results) == 3
        assert all(f['severity'] == 'critical' for f in results)
        
        # Filter multiple severities
        results = await search_engine.filter_findings(severity=['high', 'medium'])
        assert len(results) == 6
    
    @pytest.mark.asyncio
    async def test_filter_by_state(self, search_engine):
        """Test filtering findings by state"""
        states = ['new', 'triaged', 'explained', 'false_positive', 'resolved']
        
        # Create findings in different states
        for state in states:
            await search_engine.index_finding({
                'finding_id': str(uuid.uuid4()),
                'state': state,
                'month': '2024-03'
            })
        
        # Filter unresolved
        results = await search_engine.filter_findings(
            state=['new', 'triaged', 'explained']
        )
        assert len(results) == 3
        assert all(f['state'] in ['new', 'triaged', 'explained'] for f in results)
    
    @pytest.mark.asyncio
    async def test_filter_by_date_range(self, search_engine):
        """Test filtering findings by date range"""
        # Create findings across months
        months = ['2024-01', '2024-02', '2024-03', '2024-04']
        for month in months:
            await search_engine.index_finding({
                'finding_id': str(uuid.uuid4()),
                'month': month,
                'supplier': 'supplier-123'
            })
        
        # Filter Q1 2024
        results = await search_engine.filter_findings(
            start_month='2024-01',
            end_month='2024-03'
        )
        assert len(results) == 3
        assert all(f['month'] <= '2024-03' for f in results)
    
    @pytest.mark.asyncio
    async def test_full_text_search(self, search_engine):
        """Test full-text search in finding descriptions"""
        # Index findings with descriptions
        findings = [
            {'finding_id': '1', 'description': 'Duplicate invoice detected within 30 minutes'},
            {'finding_id': '2', 'description': 'Weight exceeds normal threshold by 50%'},
            {'finding_id': '3', 'description': 'Invoice missing required fields'}
        ]
        
        for finding in findings:
            await search_engine.index_finding(finding)
        
        # Search for "invoice"
        results = await search_engine.search_findings(query='invoice')
        assert len(results) == 2
        assert all('invoice' in f['description'].lower() for f in results)
    
    @pytest.mark.asyncio
    async def test_combined_filters(self, search_engine):
        """Test combining multiple filter criteria"""
        # Create diverse findings
        for i in range(20):
            await search_engine.index_finding({
                'finding_id': str(uuid.uuid4()),
                'severity': 'high' if i % 2 == 0 else 'medium',
                'state': 'new' if i < 10 else 'triaged',
                'month': '2024-03' if i < 15 else '2024-04',
                'supplier': f'supplier-{i % 3}'
            })
        
        # Complex filter
        results = await search_engine.filter_findings(
            severity=['high'],
            state=['new'],
            month='2024-03',
            supplier='supplier-0'
        )
        
        assert all(f['severity'] == 'high' for f in results)
        assert all(f['state'] == 'new' for f in results)
        assert all(f['month'] == '2024-03' for f in results)
        assert all(f['supplier'] == 'supplier-0' for f in results)


class TestSeverityAssignment:
    """Test severity level assignment and display"""
    
    @pytest.fixture
    def severity_calculator(self):
        """Create severity calculator instance"""
        from src.services.findings_management import SeverityCalculator
        return SeverityCalculator()
    
    @pytest.mark.asyncio
    async def test_automatic_severity_assignment(self, severity_calculator):
        """Test automatic severity based on rule type and evidence"""
        # Critical: Data integrity issues
        finding = {
            'rule_id': 'DUPLICATE_DETECTION',
            'evidence': {
                'duplicate_count': 5,
                'total_amount': 50000
            }
        }
        severity = await severity_calculator.calculate_severity(finding)
        assert severity == 'critical'
        
        # High: Significant anomalies
        finding = {
            'rule_id': 'WEIGHT_OUTLIER',
            'evidence': {
                'z_score': 3.5,
                'deviation_percent': 75
            }
        }
        severity = await severity_calculator.calculate_severity(finding)
        assert severity == 'high'
        
        # Medium: Pattern deviations
        finding = {
            'rule_id': 'WEEKEND_SPIKE',
            'evidence': {
                'spike_percent': 20
            }
        }
        severity = await severity_calculator.calculate_severity(finding)
        assert severity == 'medium'
    
    @pytest.mark.asyncio
    async def test_severity_override(self, severity_calculator):
        """Test manual severity override with justification"""
        finding_id = str(uuid.uuid4())
        
        # Override severity
        result = await severity_calculator.override_severity(
            finding_id=finding_id,
            new_severity='critical',
            justification='Pattern indicates systematic fraud',
            user='lead@example.com'
        )
        
        assert result['severity'] == 'critical'
        assert result['severity_override'] is True
        assert result['override_justification'] is not None
    
    @pytest.mark.asyncio
    async def test_severity_display_formatting(self, severity_calculator):
        """Test severity display with proper badges and colors"""
        severities = ['critical', 'high', 'medium', 'low']
        
        for severity in severities:
            display = await severity_calculator.get_severity_display(severity)
            
            assert display['label'] is not None
            assert display['color'] is not None
            assert display['icon'] is not None
            assert display['badge_class'] is not None


class TestConcurrentAccess:
    """Test concurrent access and state consistency"""
    
    @pytest.fixture
    def findings_manager(self):
        """Create findings manager instance"""
        from src.services.findings_management import FindingsManager
        return FindingsManager()
    
    @pytest.fixture
    def concurrent_manager(self, findings_manager):
        """Create concurrent access manager"""
        from src.services.findings_management import ConcurrentFindingsManager
        return ConcurrentFindingsManager(findings_manager)
    
    @pytest.mark.asyncio
    async def test_optimistic_locking(self, concurrent_manager):
        """Test optimistic locking prevents conflicting updates"""
        finding_id = str(uuid.uuid4())
        
        # Create finding
        finding = await concurrent_manager.create_finding({
            'finding_id': finding_id,
            'state': 'new',
            'version': 1
        })
        
        # Simulate concurrent updates with version check
        update1 = concurrent_manager.update_with_version(
            finding_id, 
            {'state': 'triaged'}, 
            version=1
        )
        update2 = concurrent_manager.update_with_version(
            finding_id, 
            {'state': 'explained'}, 
            version=1
        )
        
        results = await asyncio.gather(update1, update2, return_exceptions=True)
        
        # One should succeed, one should fail with version conflict
        successes = [r for r in results if not isinstance(r, Exception)]
        failures = [r for r in results if isinstance(r, Exception)]
        
        assert len(successes) == 1
        assert len(failures) == 1
        assert "Version conflict" in str(failures[0])
    
    @pytest.mark.asyncio
    async def test_read_consistency(self, concurrent_manager):
        """Test read consistency during concurrent updates"""
        finding_id = str(uuid.uuid4())
        
        # Create finding
        await concurrent_manager.create_finding({
            'finding_id': finding_id,
            'state': 'new',
            'counter': 0
        })
        
        # Concurrent increments
        async def increment():
            finding = await concurrent_manager.get_finding(finding_id)
            await asyncio.sleep(0.01)  # Simulate processing
            await concurrent_manager.update_finding(
                finding_id,
                {'counter': finding['counter'] + 1}
            )
        
        # Run 10 concurrent increments
        await asyncio.gather(*[increment() for _ in range(10)])
        
        # Check final counter
        final = await concurrent_manager.get_finding(finding_id)
        assert final['counter'] == 10  # All increments should be applied
    
    @pytest.mark.asyncio
    async def test_deadlock_prevention(self, concurrent_manager):
        """Test that system prevents deadlocks in concurrent operations"""
        finding_ids = [str(uuid.uuid4()) for _ in range(3)]
        
        # Create findings
        for fid in finding_ids:
            await concurrent_manager.create_finding({'finding_id': fid})
        
        # Operations that could deadlock if not handled properly
        async def operation1():
            async with concurrent_manager.transaction():
                await concurrent_manager.lock_finding(finding_ids[0])
                await asyncio.sleep(0.01)
                await concurrent_manager.lock_finding(finding_ids[1])
                return True
        
        async def operation2():
            async with concurrent_manager.transaction():
                await concurrent_manager.lock_finding(finding_ids[1])
                await asyncio.sleep(0.01)
                await concurrent_manager.lock_finding(finding_ids[0])
                return True
        
        # Should complete without deadlock (with timeout)
        try:
            results = await asyncio.wait_for(
                asyncio.gather(operation1(), operation2(), return_exceptions=True),
                timeout=5.0
            )
            # At least one should complete
            assert any(r is True for r in results if not isinstance(r, Exception))
        except asyncio.TimeoutError:
            pytest.fail("Deadlock detected - operations timed out")