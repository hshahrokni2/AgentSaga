-- SVOA Lea Platform - Database Schema
-- Following TDD approach with human-friendly IDs and EU/EES compliance

-- Create ENUM types for better data integrity
CREATE TYPE load_source_type AS ENUM ('email', 'upload', 'forwarded');
CREATE TYPE finding_severity_type AS ENUM ('info', 'warn', 'critical');
CREATE TYPE finding_state_type AS ENUM ('new', 'triaged', 'explained', 'false_positive', 'resolved');
CREATE TYPE insight_status_type AS ENUM ('open', 'explained', 'closed');
CREATE TYPE insight_source_type AS ENUM ('rule', 'ml', 'human', 'whatif');
CREATE TYPE month_status_state AS ENUM ('unreviewed', 'in_progress', 'fully_granskad');

-- Load table - tracks file ingestion
CREATE TABLE load (
    load_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source load_source_type NOT NULL,
    supplier VARCHAR(100) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    file_meta JSONB,
    parse_log JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Row table - parsed data rows with Swedish support
CREATE TABLE row (
    row_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    load_id UUID REFERENCES load(load_id) ON DELETE CASCADE,
    doc_date DATE,
    contractor VARCHAR(200),
    vehicle_reg VARCHAR(20),
    pickup_site VARCHAR(200),
    dropoff_facility VARCHAR(200),
    waste_code VARCHAR(20),
    waste_name VARCHAR(200),
    qty_value DECIMAL(10,2),
    qty_unit VARCHAR(10),
    weight_kg DECIMAL(10,2),
    dq_warnings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Finding table - rule/anomaly detection results
CREATE TABLE finding (
    finding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id VARCHAR(50) NOT NULL,
    month VARCHAR(7) NOT NULL, -- YYYY-MM format
    supplier VARCHAR(100) NOT NULL,
    row_ref UUID REFERENCES row(row_id),
    severity finding_severity_type NOT NULL DEFAULT 'warn',
    state finding_state_type NOT NULL DEFAULT 'new',
    explain_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insight table - analyst-friendly clusters with human-friendly IDs
CREATE TABLE insight (
    insight_id VARCHAR(20) PRIMARY KEY, -- INS-YYYY-MM-NNN format
    month VARCHAR(7) NOT NULL,
    supplier VARCHAR(100) NOT NULL,
    scope TEXT,
    summary TEXT NOT NULL,
    details_md TEXT,
    severity finding_severity_type NOT NULL DEFAULT 'warn',
    status insight_status_type NOT NULL DEFAULT 'open',
    source insight_source_type NOT NULL DEFAULT 'rule',
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insight link table - evidence connections
CREATE TABLE insight_link (
    link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_id VARCHAR(20) REFERENCES insight(insight_id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- row, file, chart, scenario
    ref VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scenario table - what-if analysis with human-friendly IDs
CREATE TABLE scenario (
    scenario_id VARCHAR(20) PRIMARY KEY, -- SCN-YYYY-MM-NNN format
    cohort_json JSONB NOT NULL,
    changes_json JSONB NOT NULL,
    based_on_insights VARCHAR(20)[] DEFAULT '{}',
    result_kpis_json JSONB,
    diff_summary_md TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comment table - analyst annotations
CREATE TABLE comment (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL, -- insight, scenario, month
    entity_id VARCHAR(50) NOT NULL,
    author VARCHAR(100) NOT NULL,
    text_md TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Checklist run table - month validation workflows
CREATE TABLE checklist_run (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier VARCHAR(100) NOT NULL,
    month VARCHAR(7) NOT NULL,
    checklist_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RAG embeddings table for pgvector
CREATE TABLE embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL, -- insight, scenario, comment
    entity_id VARCHAR(50) NOT NULL,
    content_text TEXT NOT NULL,
    embedding vector(384), -- Swedish BERT dimension
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance (supplier/month queries)
CREATE INDEX idx_finding_supplier_month ON finding(supplier, month);
CREATE INDEX idx_insight_supplier_month ON insight(supplier, month);
CREATE INDEX idx_row_load_date ON row(load_id, doc_date);
CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);

-- pgvector index for similarity search
CREATE INDEX idx_embeddings_vector ON embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- GIN indexes for JSONB queries
CREATE INDEX idx_load_meta ON load USING gin(file_meta);
CREATE INDEX idx_row_warnings ON row USING gin(dq_warnings);
CREATE INDEX idx_scenario_cohort ON scenario USING gin(cohort_json);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_finding_updated_at BEFORE UPDATE ON finding
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_insight_updated_at BEFORE UPDATE ON insight
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();