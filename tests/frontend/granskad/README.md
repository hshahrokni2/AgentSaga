# Granskad Workflow Test Suite

## 🔴 TDD RED Phase - Failing Tests for Swedish Waste Management Review System

This comprehensive test suite implements Test-Driven Development (TDD) for the Granskad (Audit/Review) Workflow system. All tests are designed to fail initially (RED phase) to guide implementation.

## 📋 Test Coverage

### 1. Layout & Responsiveness (`test_granskad_layout.tsx`)
- **Three-column layout**: Checklist panel (sticky), Findings table, Comment drawer
- **Sticky behavior**: Checklist panel remains visible on scroll
- **Responsive design**: Mobile, tablet, desktop, and ultrawide support
- **Column resizing**: Draggable dividers with persistence
- **Accessibility**: WCAG 2.1 AA compliance, keyboard navigation

### 2. State Machine (`test_granskad_state_machine.tsx`)
- **State transitions**: Unreviewed → In progress → Fully reviewed
- **Invalid transition blocking**: Prevents illegal state changes
- **State persistence**: LocalStorage and cross-tab synchronization
- **State history**: Complete audit trail of all transitions
- **Metadata tracking**: User, timestamp, and context for each transition

### 3. Checklist System (`test_granskad_checklist.tsx`)
- **Completion logic**: Button enabling based on required items
- **Progress tracking**: Real-time percentage and visual indicators
- **Category grouping**: Datakvalitet, Regelefterlevnad, Validering
- **Persistence**: Auto-save and restoration of checklist state
- **Accessibility**: Screen reader announcements, keyboard control

### 4. Comment System (`test_granskad_comment_system.tsx`)
- **Markdown editor**: Full formatting toolbar and keyboard shortcuts
- **Live preview**: Real-time markdown rendering
- **Required validation**: Enforces comments before completion
- **Version history**: Track all edits with diffs
- **Audit trail**: Immutable log of all comment actions

### 5. Snapshot & Audit (`test_granskad_snapshot_audit.tsx`)
- **Snapshot confirmation**: Immutable data capture before completion
- **SHA-256 hashing**: Cryptographic proof of data integrity
- **Green status validation**: Prerequisite clearance checking
- **Audit logging**: Complete trail with Swedish compliance
- **Workflow management**: Interruption, resumption, and locking

## 🚀 Running the Tests

### Run all Granskad tests:
```bash
npm test -- --config tests/frontend/granskad/jest.config.granskad.js
```

### Run specific test file:
```bash
npm test -- tests/frontend/granskad/test_granskad_layout.tsx
```

### Run with coverage:
```bash
npm test -- --coverage --config tests/frontend/granskad/jest.config.granskad.js
```

### Watch mode for TDD:
```bash
npm test -- --watch --config tests/frontend/granskad/jest.config.granskad.js
```

## 🛠️ Test Structure

```
tests/frontend/granskad/
├── __mocks__/
│   └── archon-mocks.ts       # Mock Archon API and services
├── test_granskad_layout.tsx   # Layout and responsiveness tests
├── test_granskad_state_machine.tsx # State management tests
├── test_granskad_checklist.tsx # Checklist completion tests
├── test_granskad_comment_system.tsx # Comment and markdown tests
├── test_granskad_snapshot_audit.tsx # Snapshot and audit tests
├── jest.config.granskad.js    # Jest configuration
├── setup.ts                   # Test environment setup
└── README.md                  # This file
```

## 🎯 TDD Implementation Guide

### RED Phase (Current)
All tests are written and failing. They specify the expected behavior.

### GREEN Phase (Next)
Implement minimal code to make tests pass:

1. **Components to create**:
   - `components/granskad/GranskadWorkflow.tsx`
   - `components/granskad/ChecklistPanel.tsx`
   - `components/granskad/FindingsTable.tsx`
   - `components/granskad/CommentDrawer.tsx`
   - `components/granskad/SnapshotDialog.tsx`

2. **State management**:
   - `contexts/GranskadStateContext.tsx`
   - `stores/checklistStore.ts`
   - `stores/commentStore.ts`
   - `stores/auditStore.ts`

3. **Types**:
   - `types/granskad.ts`

### REFACTOR Phase
Once tests pass, refactor for:
- Performance optimization
- Code reusability
- Better error handling
- Enhanced accessibility

## 🇸🇪 Swedish Compliance

Tests enforce Swedish-specific requirements:
- **Date formatting**: YYYY-MM-DD and Swedish month names
- **Personnummer validation**: Proper masking and GDPR compliance
- **Language**: Swedish UI text and error messages
- **Regulatory**: Swedish waste management codes and standards
- **Timezone**: Europe/Stockholm (CET/CEST)

## 📊 Coverage Thresholds

- **Global**: 80% minimum coverage
- **Components**: 85% for critical Granskad components
- **Branches**: Full coverage of state machine transitions
- **Functions**: All public APIs must be tested

## 🔍 Key Test Patterns

### Mocking
```typescript
import { mockArchonAPI } from '@/test-utils/archon-mocks';

const archonMock = mockArchonAPI();
```

### Swedish Date Formatting
```typescript
import { mockSwedishDate } from './setup';

const formatted = mockSwedishDate('2024-01-15T10:00:00Z');
// Returns: "15 januari 2024 10:00"
```

### Accessibility Testing
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

const results = await axe(container);
expect(results).toHaveNoViolations();
```

### State Machine Testing
```typescript
import { MockStateMachine } from './__mocks__/archon-mocks';

const stateMachine = new MockStateMachine('Ogranskad');
stateMachine.transition('Pågående granskning');
```

## 🐛 Debugging Tips

1. **Use verbose mode**: Shows detailed test execution
2. **Check setup.ts**: Ensure all mocks are properly configured
3. **Inspect localStorage**: Tests clear storage between runs
4. **Watch console**: Errors and warnings are filtered but logged
5. **Use test IDs**: Consistent selectors defined in setup.ts

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [jest-axe](https://github.com/nickcolley/jest-axe)
- [Swedish Standards](https://www.naturvardsverket.se/vagledning-och-stod/avfall/)

## ✅ Checklist for Implementation

- [ ] Create component structure
- [ ] Implement state machine
- [ ] Add checklist logic
- [ ] Build markdown editor
- [ ] Create snapshot system
- [ ] Add audit logging
- [ ] Implement green status validation
- [ ] Add Swedish localization
- [ ] Ensure accessibility
- [ ] All tests passing (GREEN)
- [ ] Refactor for quality
- [ ] Document implementation

---

**Remember**: These tests are your specification. They define what needs to be built. Follow TDD strictly: RED → GREEN → REFACTOR.