# 🚀 Complete Development Instructions for SVOA Lea Platform

## **CRITICAL: Start Here - Read CLAUDE.md First**

**ALWAYS** begin any development session by reading `/Users/hosseins/Dev/AgentSaga/CLAUDE.md` to understand:

- **ARCHON-FIRST RULE**: Check Archon MCP server for tasks BEFORE starting any work
- **TDD Methodology**: RED → GREEN → REFACTOR with agent-tdd-code-tester
- **BMAD Integration**: Use Business Model Analysis & Documentation pipelines
- **claude-code-project-index**: Use -i flag for codebase awareness
- **card-reviewer**: Quality validation for review→done transitions

## **Essential Workflow: ARCHON-FIRST Development**

### 1. **Connect to Archon & Check Tasks**
```typescript
// MANDATORY: Always start with Archon task management
mcp__archon__list_tasks(filter_by="status", filter_value="todo")
mcp__archon__get_task(task_id="[highest_priority_task_id]")
mcp__archon__update_task(task_id="...", status="doing")
```

### 2. **Research Phase - Use ALL Available Tools**
```typescript
// High-level patterns and architecture
mcp__archon__perform_rag_query(query="[technology] architecture patterns", match_count=5)

// Specific implementation examples
mcp__archon__search_code_examples(query="[feature] implementation", match_count=3)

// Local Claude documentation
/docs [query] // For Claude-specific guidance and syntax

// Project structure awareness
@PROJECT_INDEX.json // Use claude-code-project-index for codebase navigation
```

### 3. **TDD Implementation Cycle**
```typescript
// RED Phase: Generate failing tests
Task(subagent_type="tdd-code-tester", 
     description="Write comprehensive failing tests for [feature]",
     prompt="Generate Jest/pytest tests following TDD RED phase for [specific requirements]")

// GREEN Phase: Implement minimal code to pass tests
// Write implementation based on research findings

// REFACTOR Phase: Optimize and improve
// Enhance code quality, performance, and maintainability
```

### 4. **Quality Validation**
```typescript
// Use card-reviewer for quality assurance
Task(subagent_type="card-reviewer",
     description="Review [implementation] for quality and compliance",
     prompt="Validate implementation against Swedish/EU requirements and SVOA standards")
```

### 5. **Update Archon Status**
```typescript
mcp__archon__update_task(task_id="...", status="review") // After implementation
mcp__archon__update_task(task_id="...", status="done")   // After validation
```

## **Complete Tool Arsenal - Use Proactively**

### **MCP Archon Server Tools**
- `mcp__archon__perform_rag_query()` - Knowledge base research
- `mcp__archon__search_code_examples()` - Implementation patterns
- `mcp__archon__get_available_sources()` - Available documentation
- `mcp__archon__manage_task()` - Task lifecycle management
- `mcp__archon__manage_project()` - Project organization
- `mcp__archon__create_document()` - Documentation management

### **Task Management Tools**
- `Task()` with specialized agents:
  - `subagent_type="tdd-code-tester"` - Test generation and validation
  - `subagent_type="card-reviewer"` - Quality validation
  - `subagent_type="general-purpose"` - Complex multi-step tasks

### **File Operations**
- `Read()` - Always read files before editing
- `Write()` - Create new files (only when necessary)
- `Edit()` - Modify existing files (preferred)
- `MultiEdit()` - Multiple edits in single file
- `Glob()` - Find files by pattern
- `Grep()` - Search file contents

### **Development Tools**
- `Bash()` - Execute commands, run tests, git operations
- `WebFetch()` - Fetch external documentation
- `WebSearch()` - Search for current information
- `TodoWrite()` - Track progress and milestones

## **Swedish/EU Compliance Reminders**

### **Language & Locale Support**
- **Swedish Characters**: Always support åäöÅÄÖ
- **Date Formats**: Use sv-SE locale (YYYY-MM-DD)
- **Currency**: SEK with proper Swedish formatting
- **Personnummer**: Validate Swedish social security numbers

### **GDPR & EU Compliance**
- **Data Residency**: EU/EES regions only (eu-north-1, eu-central-1, eu-west-1)
- **Retention Policy**: 5-year minimum for waste management data
- **Audit Trails**: Immutable logging with cryptographic integrity
- **Encryption**: Customer-managed keys, AES-256 minimum
- **Right to Erasure**: Implement GDPR Article 17 compliance

### **Swedish Regulatory Requirements**
- **Waste Management**: Follow Swedish Environmental Protection Agency standards
- **Data Protection**: IMY (Swedish Data Protection Authority) compliance
- **Financial Records**: 7-year retention for accounting data
- **Environmental Data**: Permanent retention for environmental impact records

## **Project Architecture Overview**

### **Technology Stack**
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Swedish/English i18n
- **Backend**: Node.js/TypeScript services with EU compliance
- **Database**: PostgreSQL with pgvector for embeddings
- **Testing**: Jest (TypeScript), pytest (Python)
- **Infrastructure**: AWS EU regions, S3, SES, KMS

### **Key Directories**
- `src/services/` - Core business logic and external integrations
- `src/exceptions/` - Custom exception classes for error handling
- `components/` - React components with Swedish localization
- `tests/infrastructure/` - Infrastructure and compliance testing
- `tests/frontend/` - Frontend component and integration tests
- `config/` - EU infrastructure and compliance configuration

### **Current Status**
✅ **Agent Guardrails & Safety System** - Complete PII detection, policy validation
✅ **EU Email Infrastructure** - DKIM/DMARC validation, webhook processing
✅ **Object Storage & Encryption** - Customer-managed encryption, lifecycle policies

## **Git & Deployment Workflow**

### **Before Every Commit**
1. **Run Tests**: Ensure all tests pass before committing
2. **Type Checking**: Run `npm run typecheck` if available
3. **Linting**: Run `npm run lint` if available
4. **Index Update**: Use claude-code-project-index with -i flag

### **Commit Protocol**
```bash
# Always use comprehensive commit messages
git commit -m "$(cat <<'EOF'
feat: [Brief description of feature/fix]

## Technical Implementation
- Key changes and their purpose
- Architecture decisions made
- Performance/security considerations

## Testing & Validation
- Test coverage achieved
- TDD phases completed (RED/GREEN/REFACTOR)
- Validation methods used

## Compliance & Standards
- Swedish/EU compliance aspects
- GDPR considerations
- Audit trail implications

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### **Push Protocol**
```bash
# Index project first
# Use claude-code-project-index to update PROJECT_INDEX.json

# Check git status
git status

# Stage and commit changes
git add -A && git commit -m "[comprehensive message]"

# Push to remote
git push
```

## **Indexing & Project Awareness**

### **Project Index Maintenance**
- **Update Regularly**: Use claude-code-project-index after significant changes
- **File Discovery**: Use -i flag for enhanced codebase awareness
- **Structure Mapping**: Maintain PROJECT_INDEX.json for context
- **Dependency Tracking**: Monitor changes in package.json and requirements

### **Codebase Navigation**
```typescript
// Use project index for context
@PROJECT_INDEX.json // Reference existing structure

// Find files efficiently
Glob(pattern="**/*.ts") // TypeScript files
Glob(pattern="src/**/*.py") // Python services
Glob(pattern="tests/**/*.test.ts") // Test files

// Search code content
Grep(pattern="class.*Service", type="ts") // Find service classes
Grep(pattern="async function", output_mode="content") // Async functions
```

## **Common Development Patterns**

### **Service Creation Pattern**
1. **Research**: Use `mcp__archon__perform_rag_query()` for patterns
2. **TDD Red**: Generate failing tests with `tdd-code-tester`
3. **Interfaces**: Define TypeScript interfaces first
4. **Implementation**: Write minimal code to pass tests
5. **Error Handling**: Add comprehensive error handling
6. **Audit Logging**: Integrate with audit trail system
7. **Testing**: Ensure 100% coverage of critical paths
8. **Validation**: Use `card-reviewer` for quality check

### **Frontend Component Pattern**
1. **Accessibility**: Ensure WCAG 2.1 AA compliance
2. **Internationalization**: Support Swedish and English
3. **Theme Support**: Dark/light mode compatibility
4. **Responsive Design**: Mobile-first approach
5. **Error Boundaries**: Graceful error handling
6. **Performance**: Minimize re-renders, use React.memo appropriately

### **Infrastructure Pattern**
1. **EU Compliance**: Region validation for all resources
2. **Encryption**: Customer-managed keys where possible
3. **Monitoring**: CloudWatch/equivalent for all services
4. **Backup**: Cross-region replication within EU
5. **Disaster Recovery**: RTO/RPO planning for critical systems

## **Emergency Procedures**

### **System Failures**
1. **Check Archon Status**: Verify MCP server connectivity
2. **Fallback Mode**: Use TodoWrite for local task tracking
3. **Service Health**: Monitor email infrastructure and storage
4. **Data Integrity**: Verify audit trail consistency
5. **Communication**: Update stakeholders on status

### **Compliance Incidents**
1. **Data Breach**: Follow GDPR Article 33 (72-hour reporting)
2. **Audit Failures**: Investigate audit trail integrity
3. **Region Violation**: Immediate data location verification
4. **Encryption Issues**: Key rotation and security assessment

## **Performance & Optimization**

### **Database Optimization**
- **Indexing**: Composite indexes on supplier_id + month
- **Vector Search**: Optimize pgvector queries for RAG
- **Partitioning**: Time-based partitioning for large datasets
- **Query Analysis**: Regular EXPLAIN ANALYZE reviews

### **API Performance**
- **Caching**: Redis for frequently accessed data
- **Rate Limiting**: Per-supplier limits to prevent abuse
- **Compression**: Gzip for API responses
- **Connection Pooling**: Efficient database connections

### **Frontend Optimization**
- **Code Splitting**: Route-based and component-based
- **Image Optimization**: Next.js Image component usage
- **Bundle Analysis**: Regular webpack-bundle-analyzer reviews
- **Performance Monitoring**: Core Web Vitals tracking

## **Testing Strategy**

### **Test Categories**
- **Unit Tests**: Individual functions and methods (Jest/pytest)
- **Integration Tests**: Service interactions and API endpoints
- **End-to-End Tests**: Complete user workflows
- **Performance Tests**: Load testing for critical paths
- **Security Tests**: Penetration testing and vulnerability scans

### **TDD Workflow**
1. **Red Phase**: Write failing tests first
2. **Green Phase**: Implement minimal code to pass
3. **Refactor Phase**: Optimize without breaking tests
4. **Validation**: Use `tdd-code-tester` for comprehensive coverage

## **Documentation Standards**

### **Code Documentation**
- **TypeScript**: JSDoc for all public interfaces
- **Python**: Sphinx-style docstrings
- **Configuration**: Inline comments for complex settings
- **API**: OpenAPI/Swagger specifications

### **Architecture Documentation**
- **Decision Records**: ADR format for major decisions
- **Runbooks**: Operational procedures and troubleshooting
- **Compliance**: GDPR and Swedish regulatory documentation
- **Security**: Threat models and mitigation strategies

## **Next Steps After Reading**

1. **Immediate Actions**:
   - Check Archon tasks: `mcp__archon__list_tasks()`
   - Review project status: Read PROJECT_INDEX.json
   - Update project index: Use -i flag if needed

2. **Development Session**:
   - Select highest priority task from Archon
   - Research with RAG queries and code examples
   - Implement using TDD methodology
   - Validate with card-reviewer
   - Update Archon status

3. **Session Completion**:
   - Update project index
   - Commit with comprehensive message
   - Push to GitHub
   - Update documentation if needed

---

## **Remember: ARCHON-FIRST Development**

Every development decision should be:
1. **Task-Driven**: Guided by Archon task management
2. **Research-Informed**: Based on RAG queries and code examples
3. **Test-First**: Following TDD methodology
4. **Quality-Validated**: Reviewed by card-reviewer
5. **Compliance-Aware**: Meeting Swedish/EU requirements
6. **Well-Documented**: Clear commit messages and code comments

**Success Mantra**: Connect → Research → Test → Implement → Validate → Update → Commit → Push

🚀 **Ready to build world-class Swedish waste management compliance platform!**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>