# SVOA Lea Platform

EU/EES compliant waste management data quality assurance and insights platform with AI-driven analysis and reporting.

## 🏗️ Architecture Overview

- **Frontend**: Next.js + TypeScript + Tailwind + shadcn/ui (Archon-inspired)
- **Backend**: FastAPI + Pydantic
- **Database**: PostgreSQL + pgvector (RAG), DuckDB (analytics)
- **Infrastructure**: EU/EES compliant, container-based deployment
- **AI Integration**: Claude Sonnet 4, GPT-4o, Gemini routing for Swedish/English support

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and Python 3.11+
- Terraform for infrastructure deployment

### Development Setup

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd svoa-lea-platform
   npm install
   ```

2. **Start development environment**:
   ```bash
   docker-compose up -d
   ```

3. **Run tests**:
   ```bash
   # Infrastructure tests
   npm run test:infrastructure
   
   # Application tests  
   npm run test
   ```

4. **Access services**:
   - Frontend: http://localhost:3000
   - API: http://localhost:8000
   - MinIO Console: http://localhost:9001

## 📋 Development Workflow

This project follows **Archon-first task-driven development** with comprehensive TDD methodology:

### Task Management
- **Primary**: Archon MCP server for all task management
- **Reference**: See `CLAUDE.md` for complete workflow
- **TDD Integration**: Uses `agent-tdd-code-tester` for failing test generation

### Sprint Structure
- **Sprint 1**: Ingestion core (email, upload, validation)
- **Sprint 2**: Reporting v1 (KPIs, clearance system, Month Overview)  
- **Sprint 3**: Insights & Findings (rule engine, evidence linking)
- **Sprint 4**: AI Agent & Scenarios (LLM gateway, what-if analysis)

## 🔐 EU/EES Compliance

### Data Residency
- All compute and storage in EU regions
- Primary: eu-north-1 (Sweden)
- Backup: eu-central-1 (Germany)

### Security Requirements
- Encryption at rest and in transit
- GDPR compliance with 5-year retention
- Role-based access control (Inspector/Analyst/Lead/Admin)
- Complete audit trail for all operations

### Localization
- Swedish primary language
- English secondary support
- Locale-aware formatting (dates, numbers)
- Cultural UX considerations

## 🎯 Key Features

### Ingestion
- Receive-only email with forwarded thread support
- Secure web upload with drag-and-drop
- Schema validation with Great Expectations
- Auto-normalization and fuzzy matching

### Analysis
- Configurable rule engine (duplicates, outliers, operating hours)
- AI-powered anomaly detection
- Persistent insights with evidence linking
- What-if scenario modeling

### Reporting
- Green/Orange/Red month clearance metrics
- Audit-ready PDF/HTML reports
- Swedish/English report generation
- Automated distribution

### AI Integration
- Multi-provider LLM routing (Claude, GPT, Gemini)
- Swedish/English copilot for QA analysis
- RAG over historical insights and scenarios
- Comprehensive safety guardrails

## 📊 Performance Targets

- **Ingestion**: ≥50 files/day, <2min parse time
- **Scenarios**: <60s median execution, <120s p95
- **Reports**: <10s generation time
- **UI**: <1.5s page loads, WCAG 2.1 AA compliance

## 🧪 Testing

### Test Coverage Requirements
- Infrastructure: 95% compliance validation
- Application: 90+ failing test cases for TDD
- Swedish content: åäö character handling, personnummer redaction
- Performance: All SLA targets validated

### Running Tests
```bash
# All infrastructure tests
pytest tests/infrastructure/ -v

# Specific compliance tests
pytest tests/infrastructure/test_eu_ees_compliance.py -v

# Application tests with coverage
npm run test:coverage
```

## 📚 Documentation

- **Architecture**: See `/docs` for local Claude Code docs access
- **Tasks**: 32 comprehensive tasks in Archon MCP system
- **Compliance**: EU/EES requirements embedded throughout
- **TDD**: Complete test-first methodology with subagent integration

## 🌍 EU/EES Compliance Status

- ✅ **Data Residency**: EU regions only
- ✅ **GDPR**: Complete consent and retention management  
- ✅ **Encryption**: AES-256 at rest, TLS 1.3 in transit
- ✅ **Audit**: Complete trail for regulatory requirements
- ✅ **Localization**: Swedish primary with cultural considerations

---

**Project ID**: 1580c102-ee73-49ec-8619-11c722ff3ae8  
**Budget**: 85,000 SEK (ex moms) for MVP Phase 1  
**Timeline**: 4 sprints (8 weeks total)  
**Methodology**: Archon-first + TDD + BMAD integration