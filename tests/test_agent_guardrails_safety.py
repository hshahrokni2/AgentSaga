"""
Agent Guardrails & Safety System Test Suite
Following TDD principles - tests written before implementation.

Tests comprehensive AI safety with PII scanning, confirmation workflows, 
action traceability, and complete audit trails for EU/EES compliance.
"""

import unittest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
import json
import re
from typing import Dict, List, Any, Optional

# Import modules to be tested (will fail initially - RED phase)
from src.services.agent_guardrails import (
    AgentGuardrails,
    PIIDetector,
    ActionTracker,
    PolicyValidator,
    ConfirmationWorkflow,
    SecurityEnforcer
)

from src.services.agent_audit import (
    AgentAuditLogger,
    ActionAuditEntry,
    PIIDetectionEvent,
    PolicyViolationEvent
)

from src.exceptions.agent_exceptions import (
    PIIDetectionError,
    PolicyViolationError,
    UnauthorizedActionError,
    TraceabilityError,
    ConfirmationRequiredError
)


class TestPIIDetector(unittest.TestCase):
    """Test PII detection with Swedish personnummer and GDPR compliance"""
    
    def setUp(self):
        self.detector = PIIDetector(
            language_support=['sv', 'en'],
            personnummer_validation=True,
            confidence_threshold=0.8
        )
    
    def test_detect_swedish_personnummer(self):
        """Test detection of Swedish personnummer in various formats"""
        test_cases = [
            {
                'text': 'Kunden Sven Svensson (19900101-2389) har registrerat återvinning.',
                'expected_count': 1,
                'expected_type': 'personnummer',
                'expected_pattern': r'19900101-2389'
            },
            {
                'text': 'Anna Andersson, pnr: 850615-2384, telefon: 0701234567',
                'expected_count': 1,
                'expected_type': 'personnummer',
                'expected_pattern': r'850615-2384'
            },
            {
                'text': 'Koordinationsnummer: 19900161-2385',
                'expected_count': 1,
                'expected_type': 'coordination_number',
                'expected_pattern': r'19900161-2385'
            }
        ]
        
        for case in test_cases:
            with self.subTest(text=case['text'][:30]):
                detections = self.detector.scan_text(case['text'])
                
                self.assertEqual(len(detections), case['expected_count'])
                if detections:
                    self.assertEqual(detections[0].pii_type, case['expected_type'])
                    self.assertRegex(case['text'], case['expected_pattern'])
                    self.assertGreaterEqual(detections[0].confidence, 0.8)
    
    def test_detect_english_pii(self):
        """Test detection of English PII patterns"""
        test_cases = [
            {
                'text': 'Email: john.doe@company.com for waste management',
                'expected_type': 'email',
                'expected_count': 1
            },
            {
                'text': 'Phone: +46701234567, emergency contact',
                'expected_type': 'phone',
                'expected_count': 1
            },
            {
                'text': 'Credit card: 4111111111111111 (test)',
                'expected_type': 'credit_card',
                'expected_count': 1
            }
        ]
        
        for case in test_cases:
            with self.subTest(text=case['text'][:30]):
                detections = self.detector.scan_text(case['text'])
                
                self.assertEqual(len(detections), case['expected_count'])
                if detections:
                    self.assertEqual(detections[0].pii_type, case['expected_type'])
    
    def test_pii_confidence_scoring(self):
        """Test confidence scoring for PII detection accuracy"""
        test_cases = [
            {
                'text': '19900101-2389',  # Clear personnummer
                'min_confidence': 0.95
            },
            {
                'text': '199001012389',   # No hyphen, still clear
                'min_confidence': 0.90
            },
            {
                'text': '1990-01-01',     # Date format, not personnummer
                'max_confidence': 0.3
            }
        ]
        
        for case in test_cases:
            with self.subTest(text=case['text']):
                detections = self.detector.scan_text(case['text'])
                
                if 'min_confidence' in case:
                    self.assertTrue(len(detections) > 0)
                    self.assertGreaterEqual(detections[0].confidence, case['min_confidence'])
                elif 'max_confidence' in case:
                    if detections:
                        self.assertLessEqual(detections[0].confidence, case['max_confidence'])
    
    def test_batch_pii_scanning(self):
        """Test batch scanning of multiple texts for performance"""
        texts = [
            'Normal text without PII',
            'Customer: 19900101-2389',
            'Contact: anna@example.com',
            'Phone: +46701234567',
            'Mixed content with 850615-2384 and john@company.com'
        ]
        
        results = self.detector.scan_batch(texts)
        
        self.assertEqual(len(results), 5)
        self.assertEqual(len(results[0]), 0)  # No PII
        self.assertEqual(len(results[1]), 1)  # 1 personnummer
        self.assertEqual(len(results[2]), 1)  # 1 email
        self.assertEqual(len(results[3]), 1)  # 1 phone
        self.assertEqual(len(results[4]), 2)  # 1 personnummer + 1 email
    
    def test_pii_redaction_suggestions(self):
        """Test automatic PII redaction suggestions"""
        text = 'Återvinning för Sven Svensson (19900101-2389) via anna@waste.se'
        
        detections = self.detector.scan_text(text, include_redaction=True)
        
        self.assertGreater(len(detections), 0)
        for detection in detections:
            self.assertIsNotNone(detection.redacted_text)
            self.assertNotEqual(detection.original_text, detection.redacted_text)
            self.assertIn('XXXX', detection.redacted_text)


class TestActionTracker(unittest.TestCase):
    """Test comprehensive action traceability for agent interactions"""
    
    def setUp(self):
        self.tracker = ActionTracker(
            trace_all_actions=True,
            include_tool_calls=True,
            retention_days=1825  # 5 years for Swedish compliance
        )
    
    def test_trace_llm_interaction(self):
        """Test tracing of complete LLM interactions"""
        interaction = {
            'session_id': 'sess_12345',
            'user_id': 'user_67890',
            'prompt': 'Analyze waste data for anomalies in Stockholm region',
            'tools_called': ['metrics.query', 'insights.search'],
            'tool_inputs': {
                'metrics.query': {'region': 'Stockholm', 'month': '2024-01'},
                'insights.search': {'keywords': ['anomaly', 'waste']}
            },
            'tool_outputs': {
                'metrics.query': {'completeness': 0.95, 'anomalies': 3},
                'insights.search': [{'id': 'INS-2024-01-001', 'severity': 'critical'}]
            },
            'response': 'Found 3 anomalies in Stockholm data...',
            'model_used': 'claude-sonnet-4',
            'timestamp': datetime.now()
        }
        
        trace_id = self.tracker.start_interaction_trace(interaction)
        
        # Verify trace creation
        self.assertIsNotNone(trace_id)
        self.assertTrue(trace_id.startswith('TRC-'))
        
        # Verify trace contains all required elements
        trace = self.tracker.get_trace(trace_id)
        self.assertEqual(trace.session_id, 'sess_12345')
        self.assertEqual(trace.user_id, 'user_67890')
        self.assertEqual(len(trace.tool_calls), 2)
        self.assertIn('metrics.query', trace.tool_calls)
        self.assertIn('insights.search', trace.tool_calls)
    
    def test_trace_write_actions(self):
        """Test special tracking for write/modify actions"""
        write_action = {
            'action_type': 'insight.update',
            'target_id': 'INS-2024-01-001',
            'changes': {
                'status': 'explained',
                'explanation': 'Updated after manual review'
            },
            'user_id': 'analyst_123',
            'confirmation_method': 'explicit_click',
            'confirmation_timestamp': datetime.now()
        }
        
        trace_id = self.tracker.trace_write_action(write_action)
        
        # Verify write action trace
        trace = self.tracker.get_trace(trace_id)
        self.assertEqual(trace.action_type, 'insight.update')
        self.assertTrue(trace.is_write_action)
        self.assertIsNotNone(trace.confirmation_required)
        self.assertEqual(trace.confirmation_method, 'explicit_click')
    
    def test_trace_determinism_validation(self):
        """Test validation that scenario runs produce deterministic results"""
        scenario_run1 = {
            'scenario_id': 'SCN-2024-01-001',
            'inputs': {'cohort': 'Stockholm', 'changes': [{'waste_type': 'plastic', 'adjustment': 0.1}]},
            'outputs': {'completeness': 0.92, 'anomaly_count': 2},
            'model_version': 'claude-sonnet-4',
            'execution_id': 'exec_1'
        }
        
        scenario_run2 = {
            'scenario_id': 'SCN-2024-01-001',
            'inputs': {'cohort': 'Stockholm', 'changes': [{'waste_type': 'plastic', 'adjustment': 0.1}]},
            'outputs': {'completeness': 0.92, 'anomaly_count': 2},
            'model_version': 'claude-sonnet-4',
            'execution_id': 'exec_2'
        }
        
        self.tracker.record_scenario_execution(scenario_run1)
        self.tracker.record_scenario_execution(scenario_run2)
        
        # Validate determinism
        is_deterministic = self.tracker.validate_determinism(
            'SCN-2024-01-001', 
            ['exec_1', 'exec_2']
        )
        
        self.assertTrue(is_deterministic)
    
    def test_trace_context_retention(self):
        """Test that traces retain context for regulatory compliance"""
        complex_interaction = {
            'session_id': 'sess_audit_123',
            'conversation_history': [
                {'role': 'user', 'content': 'Show anomalies for Göteborg'},
                {'role': 'assistant', 'content': 'I found 5 anomalies...'},
                {'role': 'user', 'content': 'Explain the critical ones'},
                {'role': 'assistant', 'content': 'The critical anomaly...'}
            ],
            'system_context': {
                'user_role': 'senior_analyst',
                'permissions': ['read_all', 'explain_findings'],
                'region_access': ['Göteborg', 'Stockholm']
            }
        }
        
        trace_id = self.tracker.create_context_trace(complex_interaction)
        
        # Verify context preservation
        trace = self.tracker.get_trace(trace_id)
        self.assertEqual(len(trace.conversation_history), 4)
        self.assertEqual(trace.system_context['user_role'], 'senior_analyst')
        self.assertIn('Göteborg', trace.system_context['region_access'])


class TestPolicyValidator(unittest.TestCase):
    """Test policy violation detection and enforcement"""
    
    def setUp(self):
        self.validator = PolicyValidator(
            policies_config_path='config/agent_policies.yaml',
            strict_mode=True,
            swedish_compliance=True
        )
    
    def test_sql_injection_prevention(self):
        """Test detection and blocking of SQL injection attempts"""
        malicious_inputs = [
            "'; DROP TABLE findings; --",
            "1' OR '1'='1",
            "SELECT * FROM users WHERE id = 1; DELETE FROM audit_logs;",
            "UNION SELECT password FROM admin_users"
        ]
        
        for malicious_input in malicious_inputs:
            with self.subTest(input=malicious_input[:20]):
                with self.assertRaises(PolicyViolationError) as context:
                    self.validator.validate_sql_query(malicious_input)
                
                self.assertIn('SQL injection', str(context.exception))
                self.assertEqual(context.exception.violation_type, 'sql_injection')
    
    def test_read_only_enforcement(self):
        """Test enforcement of read-only operations for agent queries"""
        read_queries = [
            "SELECT * FROM findings WHERE supplier_id = 123",
            "SELECT COUNT(*) FROM insights WHERE month = '2024-01'",
            "SELECT DISTINCT waste_type FROM rows WHERE facility_id = 456"
        ]
        
        write_queries = [
            "INSERT INTO findings (title) VALUES ('Test')",
            "UPDATE insights SET status = 'resolved' WHERE id = 1",
            "DELETE FROM audit_logs WHERE timestamp < '2024-01-01'",
            "CREATE TABLE temp_data (id INT)"
        ]
        
        # Read queries should pass
        for query in read_queries:
            with self.subTest(query=query[:30]):
                result = self.validator.validate_sql_query(query)
                self.assertTrue(result.is_allowed)
                self.assertFalse(result.is_write_operation)
        
        # Write queries should be blocked
        for query in write_queries:
            with self.subTest(query=query[:30]):
                with self.assertRaises(PolicyViolationError):
                    self.validator.validate_sql_query(query)
    
    def test_tool_permission_validation(self):
        """Test validation of tool call permissions based on user role"""
        user_permissions = {
            'inspector': ['metrics.query', 'insights.search'],
            'analyst': ['metrics.query', 'insights.search', 'insights.create', 'scenarios.run'],
            'lead': ['*'],  # All tools
            'admin': ['*', 'system.backup', 'users.manage']
        }
        
        test_cases = [
            {
                'role': 'inspector',
                'tool': 'metrics.query',
                'should_allow': True
            },
            {
                'role': 'inspector',
                'tool': 'insights.create',
                'should_allow': False
            },
            {
                'role': 'analyst',
                'tool': 'scenarios.run',
                'should_allow': True
            },
            {
                'role': 'analyst',
                'tool': 'users.manage',
                'should_allow': False
            }
        ]
        
        for case in test_cases:
            with self.subTest(role=case['role'], tool=case['tool']):
                is_allowed = self.validator.check_tool_permission(
                    case['role'], 
                    case['tool']
                )
                self.assertEqual(is_allowed, case['should_allow'])
    
    def test_data_access_boundaries(self):
        """Test enforcement of data access boundaries by region/supplier"""
        access_requests = [
            {
                'user_region': ['Stockholm'],
                'requested_data': {'region': 'Stockholm', 'supplier_id': 123},
                'should_allow': True
            },
            {
                'user_region': ['Stockholm'],
                'requested_data': {'region': 'Göteborg', 'supplier_id': 456},
                'should_allow': False
            },
            {
                'user_region': ['Stockholm', 'Göteborg'],
                'requested_data': {'region': 'Göteborg', 'supplier_id': 789},
                'should_allow': True
            }
        ]
        
        for request in access_requests:
            with self.subTest(regions=request['user_region']):
                is_allowed = self.validator.check_data_access(
                    user_regions=request['user_region'],
                    requested_data=request['requested_data']
                )
                self.assertEqual(is_allowed, request['should_allow'])


class TestConfirmationWorkflow(unittest.TestCase):
    """Test propose→apply confirmation workflows for write actions"""
    
    def setUp(self):
        self.workflow = ConfirmationWorkflow(
            require_confirmation_for=['create', 'update', 'delete', 'merge'],
            confirmation_timeout=300,  # 5 minutes
            audit_confirmations=True
        )
    
    def test_propose_phase(self):
        """Test creation of proposal for user confirmation"""
        proposal = {
            'action_type': 'insight.create',
            'description': 'Create new insight from anomaly pattern',
            'preview': {
                'title': 'High plastic waste in Stockholm facilities',
                'severity': 'warning',
                'affected_facilities': ['FAC-001', 'FAC-002', 'FAC-003']
            },
            'impact_assessment': 'Will create 1 new insight, link 3 facilities',
            'reversibility': 'Can be deleted or modified after creation'
        }
        
        proposal_id = self.workflow.create_proposal(proposal)
        
        # Verify proposal structure
        self.assertIsNotNone(proposal_id)
        stored_proposal = self.workflow.get_proposal(proposal_id)
        self.assertEqual(stored_proposal.status, 'pending')
        self.assertEqual(stored_proposal.action_type, 'insight.create')
        self.assertIsNotNone(stored_proposal.expires_at)
    
    def test_apply_phase_with_confirmation(self):
        """Test application of confirmed proposal"""
        # Create proposal
        proposal = {
            'action_type': 'insight.update',
            'target_id': 'INS-2024-01-001',
            'changes': {'status': 'explained', 'notes': 'Manual review completed'}
        }
        
        proposal_id = self.workflow.create_proposal(proposal)
        
        # Simulate user confirmation
        confirmation = {
            'user_id': 'analyst_123',
            'confirmed_at': datetime.now(),
            'confirmation_method': 'ui_button_click',
            'user_comment': 'Approved after thorough review'
        }
        
        result = self.workflow.apply_proposal(proposal_id, confirmation)
        
        # Verify successful application
        self.assertTrue(result.success)
        self.assertEqual(result.action_performed, 'insight.update')
        self.assertIsNotNone(result.audit_trail_id)
    
    def test_proposal_timeout(self):
        """Test that proposals expire after timeout period"""
        proposal = {
            'action_type': 'insight.delete',
            'target_id': 'INS-2024-01-002'
        }
        
        proposal_id = self.workflow.create_proposal(proposal)
        
        # Simulate timeout by setting expires_at to past
        stored_proposal = self.workflow.get_proposal(proposal_id)
        stored_proposal.expires_at = datetime.now() - timedelta(minutes=1)
        
        # Attempt to apply expired proposal
        confirmation = {
            'user_id': 'analyst_123',
            'confirmed_at': datetime.now(),
            'confirmation_method': 'ui_button_click'
        }
        
        with self.assertRaises(ConfirmationRequiredError) as context:
            self.workflow.apply_proposal(proposal_id, confirmation)
        
        self.assertIn('expired', str(context.exception))
    
    def test_batch_proposal_handling(self):
        """Test handling of batch operations requiring confirmation"""
        batch_proposal = {
            'action_type': 'findings.bulk_status_change',
            'target_ids': ['FND-001', 'FND-002', 'FND-003', 'FND-004'],
            'changes': {'status': 'resolved'},
            'batch_size': 4
        }
        
        proposal_id = self.workflow.create_batch_proposal(batch_proposal)
        
        # Verify batch proposal structure
        stored_proposal = self.workflow.get_proposal(proposal_id)
        self.assertEqual(stored_proposal.batch_size, 4)
        self.assertEqual(len(stored_proposal.target_ids), 4)
        self.assertTrue(stored_proposal.is_batch_operation)


class TestSecurityEnforcer(unittest.TestCase):
    """Test security boundary enforcement and monitoring"""
    
    def setUp(self):
        self.enforcer = SecurityEnforcer(
            max_queries_per_minute=60,
            max_concurrent_sessions=10,
            suspicious_pattern_detection=True,
            audit_security_events=True
        )
    
    def test_rate_limiting(self):
        """Test rate limiting to prevent abuse"""
        user_id = 'test_user_123'
        
        # Should allow normal usage
        for i in range(50):
            allowed = self.enforcer.check_rate_limit(user_id)
            self.assertTrue(allowed, f"Query {i} should be allowed")
        
        # Should block after limit exceeded
        for i in range(20):
            allowed = self.enforcer.check_rate_limit(user_id)
            self.assertFalse(allowed, f"Query {i+50} should be blocked")
    
    def test_concurrent_session_limiting(self):
        """Test concurrent session limits"""
        user_id = 'test_user_concurrent'
        
        # Create maximum allowed sessions
        session_ids = []
        for i in range(10):
            session_id = self.enforcer.create_session(user_id)
            session_ids.append(session_id)
            self.assertIsNotNone(session_id)
        
        # Next session should be rejected
        with self.assertRaises(UnauthorizedActionError):
            self.enforcer.create_session(user_id)
        
        # Clean up one session, new session should be allowed
        self.enforcer.close_session(session_ids[0])
        new_session_id = self.enforcer.create_session(user_id)
        self.assertIsNotNone(new_session_id)
    
    def test_suspicious_pattern_detection(self):
        """Test detection of suspicious access patterns"""
        suspicious_patterns = [
            # Rapid-fire queries
            {'user_id': 'sus_user_1', 'pattern': 'rapid_queries', 'queries': 200},
            # Unusual time access
            {'user_id': 'sus_user_2', 'pattern': 'off_hours', 'time': datetime(2024, 1, 1, 3, 0)},
            # Geographic anomaly
            {'user_id': 'sus_user_3', 'pattern': 'geo_anomaly', 'ip': '192.168.1.1', 'usual_country': 'SE', 'current_country': 'CN'}
        ]
        
        for pattern in suspicious_patterns:
            with self.subTest(pattern=pattern['pattern']):
                is_suspicious = self.enforcer.detect_suspicious_activity(pattern)
                self.assertTrue(is_suspicious)
    
    def test_privilege_escalation_detection(self):
        """Test detection of privilege escalation attempts"""
        escalation_attempts = [
            {
                'user_id': 'inspector_123',
                'current_role': 'inspector',
                'requested_action': 'users.create',  # Admin-only action
                'should_detect': True
            },
            {
                'user_id': 'analyst_456',
                'current_role': 'analyst',
                'requested_action': 'insights.create',  # Allowed action
                'should_detect': False
            }
        ]
        
        for attempt in escalation_attempts:
            with self.subTest(user=attempt['user_id']):
                is_escalation = self.enforcer.detect_privilege_escalation(
                    attempt['user_id'],
                    attempt['current_role'],
                    attempt['requested_action']
                )
                self.assertEqual(is_escalation, attempt['should_detect'])


class TestAgentAuditLogger(unittest.TestCase):
    """Test comprehensive audit logging for agent actions"""
    
    def setUp(self):
        self.audit_logger = AgentAuditLogger(
            log_directory='logs/agent_audit',
            retention_days=1825,  # 5 years
            encryption_enabled=True,
            immutable_storage=True
        )
    
    async def test_log_pii_detection_event(self):
        """Test logging of PII detection events"""
        pii_event = PIIDetectionEvent(
            detection_id='PII-2024-01-001',
            text_source='user_input',
            pii_types=['personnummer', 'email'],
            confidence_scores=[0.95, 0.88],
            action_taken='redacted',
            user_id='analyst_123'
        )
        
        audit_id = await self.audit_logger.log_pii_event(pii_event)
        
        # Verify audit entry creation
        self.assertIsNotNone(audit_id)
        audit_entry = await self.audit_logger.get_audit_entry(audit_id)
        self.assertEqual(audit_entry.event_type, 'pii_detection')
        self.assertEqual(len(audit_entry.pii_types), 2)
    
    async def test_log_policy_violation(self):
        """Test logging of policy violations"""
        violation_event = PolicyViolationEvent(
            violation_id='POL-2024-01-001',
            violation_type='sql_injection_attempt',
            severity='critical',
            user_id='suspicious_user',
            blocked_action='SELECT * FROM users; DROP TABLE findings;',
            detection_method='pattern_matching',
            ip_address='192.168.1.100'
        )
        
        audit_id = await self.audit_logger.log_policy_violation(violation_event)
        
        # Verify violation logging
        audit_entry = await self.audit_logger.get_audit_entry(audit_id)
        self.assertEqual(audit_entry.severity, 'critical')
        self.assertEqual(audit_entry.violation_type, 'sql_injection_attempt')
        self.assertTrue(audit_entry.blocked_action)
    
    async def test_audit_trail_integrity(self):
        """Test that audit trails maintain cryptographic integrity"""
        # Log multiple events
        events = [
            ActionAuditEntry(action='insight.create', user_id='user1'),
            ActionAuditEntry(action='finding.update', user_id='user2'),
            ActionAuditEntry(action='scenario.run', user_id='user3')
        ]
        
        audit_ids = []
        for event in events:
            audit_id = await self.audit_logger.log_action(event)
            audit_ids.append(audit_id)
        
        # Verify chain integrity
        is_intact = await self.audit_logger.verify_chain_integrity(audit_ids)
        self.assertTrue(is_intact)
        
        # Simulate tampering
        audit_entry = await self.audit_logger.get_audit_entry(audit_ids[1])
        audit_entry.action = 'modified_action'  # Simulate tampering
        
        # Integrity check should fail
        is_intact_after_tampering = await self.audit_logger.verify_chain_integrity(audit_ids)
        self.assertFalse(is_intact_after_tampering)
    
    async def test_audit_search_and_compliance_reporting(self):
        """Test audit log searching and compliance reporting capabilities"""
        # Create audit entries over time range
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        
        # Search by date range
        search_results = await self.audit_logger.search_audit_logs(
            date_from=start_date,
            date_to=end_date,
            event_types=['pii_detection', 'policy_violation']
        )
        
        # Generate compliance report
        compliance_report = await self.audit_logger.generate_compliance_report(
            period_from=start_date,
            period_to=end_date,
            include_pii_events=True,
            include_violations=True
        )
        
        # Verify report structure
        self.assertIsNotNone(compliance_report)
        self.assertIn('pii_events_count', compliance_report)
        self.assertIn('policy_violations_count', compliance_report)
        self.assertIn('users_affected', compliance_report)


class TestAgentGuardrailsIntegration(unittest.TestCase):
    """Integration tests for complete agent guardrails system"""
    
    def setUp(self):
        self.guardrails = AgentGuardrails(
            pii_detection_enabled=True,
            policy_validation_enabled=True,
            action_tracking_enabled=True,
            confirmation_workflow_enabled=True,
            audit_logging_enabled=True
        )
    
    async def test_complete_agent_interaction_pipeline(self):
        """Test complete pipeline: input → PII scan → policy check → action → audit"""
        user_input = {
            'user_id': 'analyst_789',
            'session_id': 'sess_integration_test',
            'query': 'Show anomalies for customer 19900101-2389 in Stockholm region',
            'requested_action': 'metrics.query',
            'parameters': {'region': 'Stockholm', 'customer_filter': '19900101-2389'}
        }
        
        # Process through guardrails pipeline
        result = await self.guardrails.process_agent_request(user_input)
        
        # Verify PII was detected and handled
        self.assertTrue(result.pii_detected)
        self.assertEqual(len(result.pii_detections), 1)
        self.assertEqual(result.pii_detections[0].pii_type, 'personnummer')
        
        # Verify policy validation passed
        self.assertTrue(result.policy_check_passed)
        
        # Verify action was tracked
        self.assertIsNotNone(result.trace_id)
        
        # Verify audit trail created
        self.assertIsNotNone(result.audit_id)
    
    async def test_blocking_malicious_request(self):
        """Test that malicious requests are blocked at multiple levels"""
        malicious_input = {
            'user_id': 'attacker_user',
            'query': "'; DROP TABLE findings; SELECT * FROM admin_users WHERE password = 'admin'; --",
            'requested_action': 'warehouse.sql_execute',
            'parameters': {'raw_sql': "'; DROP TABLE findings; --"}
        }
        
        # Should be blocked by guardrails
        with self.assertRaises(PolicyViolationError) as context:
            await self.guardrails.process_agent_request(malicious_input)
        
        # Verify specific violation type
        self.assertEqual(context.exception.violation_type, 'sql_injection')
        
        # Verify audit log was created for the attempt
        violation_logs = await self.guardrails.audit_logger.search_violations(
            user_id='attacker_user',
            violation_type='sql_injection'
        )
        self.assertGreater(len(violation_logs), 0)
    
    async def test_confirmation_workflow_integration(self):
        """Test integration with confirmation workflow for write actions"""
        write_request = {
            'user_id': 'lead_analyst_456',
            'action_type': 'insight.create',
            'parameters': {
                'title': 'New anomaly pattern detected',
                'severity': 'warning',
                'description': 'Unusual waste patterns in Göteborg facilities'
            }
        }
        
        # Should create proposal requiring confirmation
        result = await self.guardrails.process_write_request(write_request)
        
        self.assertTrue(result.requires_confirmation)
        self.assertIsNotNone(result.proposal_id)
        self.assertEqual(result.status, 'pending_confirmation')
        
        # Simulate user confirmation
        confirmation_result = await self.guardrails.confirm_proposal(
            result.proposal_id,
            user_id='lead_analyst_456',
            confirmation_method='ui_approval'
        )
        
        self.assertTrue(confirmation_result.success)
        self.assertEqual(confirmation_result.action_performed, 'insight.create')
    
    def test_offline_evaluation_harness(self):
        """Test offline evaluation capabilities for safety accuracy"""
        test_cases = [
            {
                'input': 'Normal query about waste data',
                'expected_pii': False,
                'expected_violation': False
            },
            {
                'input': 'Customer data for 19900101-2389',
                'expected_pii': True,
                'expected_violation': False
            },
            {
                'input': "'; DROP TABLE users; --",
                'expected_pii': False,
                'expected_violation': True
            }
        ]
        
        evaluation_results = self.guardrails.run_offline_evaluation(test_cases)
        
        # Verify accuracy metrics
        self.assertGreaterEqual(evaluation_results['pii_detection_accuracy'], 0.9)
        self.assertGreaterEqual(evaluation_results['violation_detection_accuracy'], 0.95)
        self.assertLessEqual(evaluation_results['false_positive_rate'], 0.05)


if __name__ == '__main__':
    # Run async tests
    async def run_async_tests():
        loader = unittest.TestLoader()
        suite = unittest.TestSuite()
        
        # Add async test classes
        for test_class in [TestAgentAuditLogger, TestAgentGuardrailsIntegration]:
            tests = loader.loadTestsFromTestCase(test_class)
            for test in tests:
                if asyncio.iscoroutinefunction(getattr(test, test._testMethodName)):
                    suite.addTest(test)
        
        # Run async tests
        runner = unittest.TextTestRunner(verbosity=2)
        runner.run(suite)
    
    # Run synchronous tests first
    unittest.main(exit=False)
    
    # Then run async tests
    asyncio.run(run_async_tests())