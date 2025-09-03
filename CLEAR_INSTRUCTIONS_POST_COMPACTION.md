# 🚀 Clear Instructions After Compaction

## **CRITICAL: Read CLAUDE.md First**
Always start by reading `/Users/hosseins/Dev/AgentSaga/CLAUDE.md` to understand:
- ARCHON-FIRST RULE: Always check Archon MCP server for tasks BEFORE starting any work
- TDD methodology: RED → GREEN → REFACTOR with agent-tdd-code-tester
- BMAD pipelines integration
- claude-code-project-index usage with -i flag
- card-reviewer agent for quality validation

## **Project Status Summary**

### ✅ **Completed Infrastructure**
1. **Agent Guardrails & Safety System** - Full PII detection, GDPR compliance, audit trails
2. **EU Email Infrastructure & Object Storage** - DKIM/DMARC validation, customer-managed encryption, TDD methodology

### 🏗️ **Current Architecture**
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, Swedish/English i18n
- **Backend Services**: Node.js/TypeScript services with EU/EES compliance
- **Database**: PostgreSQL with pgvector extension for embeddings
- **Testing**: Jest for TypeScript, pytest for Python, comprehensive TDD approach
- **Compliance**: Full Swedish regulatory compliance, GDPR, 5-year retention

### 📁 **Key Directories**
- `src/services/` - Core business logic services
- `src/exceptions/` - Custom exception classes
- `tests/infrastructure/` - Infrastructure testing (Python + TypeScript)
- `tests/frontend/` - Frontend component tests
- `components/` - React components with Swedish localization
- `config/` - EU infrastructure configuration files

## **Next Steps Workflow**

1. **Check Archon Tasks**
   ```typescript
   mcp__archon__list_tasks(filter_by="status", filter_value="todo")
   ```

2. **Research Phase** (Use all tools)
   ```typescript
   // High-level patterns
   mcp__archon__perform_rag_query(query="[technology] architecture patterns", match_count=5)
   
   // Code examples  
   mcp__archon__search_code_examples(query="[specific feature] implementation", match_count=3)
   
   // Local Claude docs
   /docs [query] // Use claude-code-docs for Claude-specific guidance
   
   // Project awareness
   @PROJECT_INDEX.json // Use claude-code-project-index for structural awareness
   ```

3. **TDD Implementation**
   ```typescript
   // RED Phase - Generate failing tests
   Task(subagent_type="tdd-code-tester", description="Write failing tests for [feature]")
   
   // GREEN Phase - Implement to pass tests
   // Write minimal code to pass tests
   
   // REFACTOR Phase - Optimize
   // Improve code quality and performance
   ```

4. **Quality Validation**
   ```typescript
   Task(subagent_type="card-reviewer", description="Review [implementation]")
   ```

5. **Update Archon**
   ```typescript
   mcp__archon__update_task(task_id="...", status="done")
   ```

## **Swedish Compliance Reminders**
- Always use Swedish locale (sv-SE) for dates, numbers, currency
- Support Swedish characters: åäöÅÄÖ
- 5-year retention policy for all data
- EU/EES data residency enforcement
- GDPR-compliant audit trails

## **Testing Strategy**
- **TypeScript**: Jest tests for services and components
- **Python**: pytest for infrastructure validation
- **TDD**: Always RED → GREEN → REFACTOR
- **Integration**: Use agent-tdd-code-tester for comprehensive test generation

## **Deployment & Git**
- Always commit with descriptive messages ending with Claude Code attribution
- Use semantic versioning for releases
- All infrastructure runs in EU regions (eu-north-1, eu-central-1, eu-west-1)

## **Emergency Contacts & Resources**
- SVOA Lea Platform documentation in `README.md`
- EU compliance requirements in `config/compliance.json`
- Infrastructure tests in `tests/infrastructure/`
- Swedish translations in `locales/sv/common.json`

---

**Remember**: This is a Swedish waste management compliance platform. Every decision should prioritize data security, EU compliance, and Swedish regulatory requirements. Always use Archon MCP server as your primary task management system.

🤖 Generated with [Claude Code](https://claude.ai/code)