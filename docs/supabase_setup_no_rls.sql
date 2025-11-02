-- ============================================================================
-- INSITE-BASH PORTFOLIO GENERATOR - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This script creates all tables, relationships, and constraints for the
-- Insite-Bash portfolio generator SaaS platform.
-- 
-- Execute this in your Supabase SQL Editor.
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- 1. TENANCY & AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  user_role TEXT,
  photo_url TEXT,
  headline TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- ============================================================================
-- 2. DOCUMENTS & SOURCE MATERIALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('resume_pdf','resume_docx','linkedin','manual')),
  storage_url TEXT NOT NULL,
  text_extracted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- ============================================================================
-- 3. COMPANIES & ASSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  alt_names TEXT[] DEFAULT '{}',
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_canonical_name ON companies(canonical_name);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT CHECK (kind IN (
    'logo_svg','logo_png','nameplate_svg','resume_pdf',
    'portrait_src','portrait_upscaled','banner_generated',
    'feature_square_generated','card_portrait_generated',
    'cert_banner_generated','subject_mask','other'
  )),
  label TEXT,
  storage_url TEXT NOT NULL,
  variant JSONB DEFAULT '{}'::JSONB,
  source TEXT,
  checksum TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);

CREATE TABLE IF NOT EXISTS company_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_company_assets_company_id ON company_assets(company_id);

-- ============================================================================
-- 4. WORK EXPERIENCE & ACHIEVEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_experiences_user_id ON work_experiences(user_id);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_experience_id UUID REFERENCES work_experiences(id) ON DELETE CASCADE,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  raw_text TEXT NOT NULL,
  metric_value_numeric NUMERIC,
  metric_unit TEXT,
  metric_label TEXT,
  impact_statement TEXT,
  evidence_strength REAL DEFAULT 0.0 CHECK (evidence_strength BETWEEN 0 AND 1),
  verified BOOLEAN DEFAULT FALSE,
  provenance TEXT DEFAULT 'user_provided' CHECK (provenance IN ('user_provided','model_context','industry_template')),
  confidence REAL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  requires_review BOOLEAN DEFAULT FALSE,
  is_placeholder BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_work_experience_id ON achievements(work_experience_id);
CREATE INDEX IF NOT EXISTS idx_achievements_provenance ON achievements(provenance);

-- ============================================================================
-- 5. ACHIEVEMENT RANKINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievement_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'default',
  items JSONB NOT NULL,
  scoring JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_rankings_user_id ON achievement_rankings(user_id);

-- ============================================================================
-- 6. SKILLS & OFFERINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);

CREATE TABLE IF NOT EXISTS skill_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  offer_summary TEXT,
  proof_points TEXT[],
  rank SMALLINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_offers_user_id ON skill_offers(user_id);

-- ============================================================================
-- 7. STORY CONTENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  opener TEXT,
  narrative_paragraphs TEXT[],
  quote TEXT,
  quote_attribution TEXT,
  purpose TEXT,
  cta_label TEXT,
  cta_href TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);

-- ============================================================================
-- 8. SITE SETTINGS & VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subdomain TEXT UNIQUE,
  theme JSONB DEFAULT '{}'::JSONB,
  published_version_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_settings_user_id ON site_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_site_settings_subdomain ON site_settings(subdomain);

CREATE TABLE IF NOT EXISTS site_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  career_graph_snapshot JSONB NOT NULL,
  build_status TEXT CHECK (build_status IN ('draft','building','published','failed')) DEFAULT 'draft',
  preview_url TEXT,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_versions_user_id ON site_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_site_versions_build_status ON site_versions(build_status);

-- ============================================================================
-- 9. IMAGE GENERATION & PLACEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS image_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  model TEXT,
  archetype TEXT CHECK (archetype IN ('hero','formal','desk','casual')),
  seed TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  likeness_score REAL CHECK (likeness_score BETWEEN 0 AND 1),
  artifact_score REAL CHECK (artifact_score BETWEEN 0 AND 1),
  framing_score REAL CHECK (framing_score BETWEEN 0 AND 1),
  style_score REAL CHECK (style_score BETWEEN 0 AND 1),
  final_score REAL CHECK (final_score BETWEEN 0 AND 1),
  status TEXT CHECK (status IN ('generated','upscaled','failed')) DEFAULT 'generated',
  generated_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  upscaled_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  mask_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_generations_user_id ON image_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_image_generations_archetype ON image_generations(archetype);
CREATE INDEX IF NOT EXISTS idx_image_generations_status ON image_generations(status);

CREATE TABLE IF NOT EXISTS image_placements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  site_version_id UUID REFERENCES site_versions(id) ON DELETE CASCADE,
  placement TEXT CHECK (placement IN ('hero','achievements_general_main','achievements_career_main','certifications_bg')),
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  crop JSONB,
  gradient JSONB,
  chosen_by TEXT CHECK (chosen_by IN ('system','user')) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_placements_user_id ON image_placements(user_id);
CREATE INDEX IF NOT EXISTS idx_image_placements_site_version_id ON image_placements(site_version_id);

-- ============================================================================
-- 10. COMPLETENESS TRACKING (HEF)
-- ============================================================================

CREATE TABLE IF NOT EXISTS completeness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  section TEXT CHECK (section IN ('navigation','logos','achievements','skills','story','timeline','images')),
  coverage_score SMALLINT CHECK (coverage_score BETWEEN 0 AND 100),
  missing_fields TEXT[],
  decided_strategy TEXT CHECK (decided_strategy IN ('polish','context','qualitative','template','hide')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_completeness_user_id ON completeness(user_id);

-- ============================================================================
-- 11. ROLE/INDUSTRY LIBRARY (HEF)
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_slug TEXT NOT NULL,
  industry_slug TEXT,
  outcomes TEXT[],
  processes TEXT[],
  tools TEXT[],
  writing_patterns TEXT[],
  metric_ladders JSONB,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_library_role_slug ON role_library(role_slug);
CREATE INDEX IF NOT EXISTS idx_role_library_industry_slug ON role_library(industry_slug);

-- ============================================================================
-- 12. PIPELINE ORCHESTRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT CHECK (kind IN ('ingest','logos','achievements','skills','story','timeline','navigation','images','render','export')),
  status TEXT CHECK (status IN ('queued','running','succeeded','failed','canceled')) DEFAULT 'queued',
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_id ON pipeline_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_kind ON pipeline_runs(kind);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);

-- ============================================================================
-- 13. ANALYTICS & EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  site_version_id UUID REFERENCES site_versions(id) ON DELETE SET NULL,
  event_name TEXT,
  event_time TIMESTAMPTZ DEFAULT NOW(),
  path TEXT,
  referrer TEXT,
  ua TEXT,
  ip INET
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_event_time ON events(event_time);

-- ============================================================================
-- 14. UPDATED_AT TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_experiences_updated_at ON work_experiences;
CREATE TRIGGER update_work_experiences_updated_at BEFORE UPDATE ON work_experiences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements;
CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_achievement_rankings_updated_at ON achievement_rankings;
CREATE TRIGGER update_achievement_rankings_updated_at BEFORE UPDATE ON achievement_rankings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_skill_offers_updated_at ON skill_offers;
CREATE TRIGGER update_skill_offers_updated_at BEFORE UPDATE ON skill_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stories_updated_at ON stories;
CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_versions_updated_at ON site_versions;
CREATE TRIGGER update_site_versions_updated_at BEFORE UPDATE ON site_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pipeline_runs_updated_at ON pipeline_runs;
CREATE TRIGGER update_pipeline_runs_updated_at BEFORE UPDATE ON pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run the RLS policies script (supabase_rls_policies.sql)
-- 2. Run the helper functions script (supabase_functions.sql)
-- 3. Seed the role_library table with initial data
-- ============================================================================
-- ============================================================================
-- INSITE-BASH - HELPER FUNCTIONS & UTILITIES
-- ============================================================================
-- This script creates utility functions for common operations
-- 
-- Execute this AFTER running supabase_schema.sql and supabase_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- 1. FUNCTION: GET USER'S CAREER GRAPH
-- ============================================================================

CREATE OR REPLACE FUNCTION get_career_graph(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user', (
      SELECT jsonb_build_object(
        'id', id,
        'first_name', first_name,
        'last_name', COALESCE(last_name, ''),
        'full_name', CONCAT(first_name, ' ', COALESCE(last_name, '')),
        'current_role', current_role,
        'photo_url', photo_url,
        'headline', headline
      )
      FROM users
      WHERE id = p_user_id
    ),
    'work_experiences', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', we.id,
          'company', c.canonical_name,
          'title', we.title,
          'start_date', we.start_date,
          'end_date', we.end_date,
          'location', we.location,
          'description', we.description,
          'achievements', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'metric_value', a.metric_value_numeric,
                'metric_unit', a.metric_unit,
                'metric_label', a.metric_label,
                'impact_statement', a.impact_statement,
                'evidence_strength', a.evidence_strength,
                'provenance', a.provenance,
                'confidence', a.confidence
              )
            ), '[]'::jsonb)
            FROM achievements a
            WHERE a.work_experience_id = we.id
          )
        )
      ), '[]'::jsonb)
      FROM work_experiences we
      LEFT JOIN companies c ON we.company_id = c.id
      WHERE we.user_id = p_user_id
      ORDER BY we.start_date DESC
    ),
    'ranked_achievements', (
      SELECT items
      FROM achievement_rankings
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT 1
    ),
    'skills', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'level', s.level,
          'offer_summary', so.offer_summary,
          'proof_points', so.proof_points,
          'rank', so.rank
        )
      ), '[]'::jsonb)
      FROM skills s
      LEFT JOIN skill_offers so ON s.id = so.skill_id
      WHERE s.user_id = p_user_id
      ORDER BY so.rank
    ),
    'story', (
      SELECT jsonb_build_object(
        'opener', opener,
        'narrative_paragraphs', narrative_paragraphs,
        'quote', quote,
        'quote_attribution', quote_attribution,
        'purpose', purpose,
        'cta', jsonb_build_object(
          'label', cta_label,
          'href', cta_href
        )
      )
      FROM stories
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT 1
    ),
    'assets', (
      SELECT jsonb_build_object(
        'nameplate_svg', (
          SELECT storage_url
          FROM assets
          WHERE user_id = p_user_id AND kind = 'nameplate_svg'
          ORDER BY created_at DESC
          LIMIT 1
        ),
        'logos', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'company', c.canonical_name,
              'src_svg', a.storage_url,
              'variant', a.variant,
              'source', a.source
            )
          ), '[]'::jsonb)
          FROM company_assets ca
          JOIN assets a ON ca.asset_id = a.id
          JOIN companies c ON ca.company_id = c.id
          WHERE a.user_id = p_user_id AND a.kind IN ('logo_svg', 'logo_png')
        )
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. FUNCTION: CALCULATE ACHIEVEMENT SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_achievement_score(
  p_metric_value NUMERIC,
  p_metric_unit TEXT,
  p_org_scope REAL DEFAULT 0.5,
  p_evidence_strength REAL DEFAULT 0.5,
  p_achievement_date DATE DEFAULT CURRENT_DATE,
  p_relevance REAL DEFAULT 0.5
)
RETURNS REAL AS $$
DECLARE
  v_metric_strength REAL := 0.0;
  v_recency_score REAL := 0.0;
  v_age_years REAL;
  v_final_score REAL;
BEGIN
  -- Normalize metric strength (0-1 scale)
  IF p_metric_value IS NOT NULL THEN
    CASE p_metric_unit
      WHEN 'usd', 'MUSD' THEN
        -- Logarithmic scale for currency
        v_metric_strength := LEAST(1.0, LOG(10, GREATEST(1, p_metric_value / 1000000.0)));
      WHEN 'percent' THEN
        -- Cap at 100%
        v_metric_strength := LEAST(1.0, p_metric_value / 100.0);
      WHEN 'count' THEN
        -- Logarithmic scale for counts
        v_metric_strength := LEAST(1.0, LOG(10, GREATEST(1, p_metric_value / 10.0)));
      ELSE
        v_metric_strength := 0.5;
    END CASE;
  END IF;
  
  -- Calculate recency score (1 / age_in_years)
  v_age_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_achievement_date));
  v_recency_score := 1.0 / GREATEST(1.0, v_age_years);
  
  -- Weighted score calculation
  v_final_score := 
    0.35 * v_metric_strength +
    0.20 * p_org_scope +
    0.15 * p_evidence_strength +
    0.15 * v_recency_score +
    0.15 * p_relevance;
  
  RETURN v_final_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. FUNCTION: GET COMPLETENESS SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_completeness_score(p_user_id UUID, p_section TEXT)
RETURNS SMALLINT AS $$
DECLARE
  v_score SMALLINT := 0;
  v_count INT;
BEGIN
  CASE p_section
    WHEN 'navigation' THEN
      -- Check if user has first_name
      SELECT CASE WHEN first_name IS NOT NULL THEN 100 ELSE 0 END
      INTO v_score
      FROM users
      WHERE id = p_user_id;
      
    WHEN 'logos' THEN
      -- Check if user has company logos
      SELECT CASE WHEN COUNT(*) > 0 THEN 100 ELSE 0 END
      INTO v_score
      FROM assets
      WHERE user_id = p_user_id AND kind IN ('logo_svg', 'logo_png');
      
    WHEN 'achievements' THEN
      -- Check if user has achievements with metrics
      SELECT COUNT(*) INTO v_count
      FROM achievements a
      JOIN work_experiences we ON a.work_experience_id = we.id
      WHERE we.user_id = p_user_id;
      
      IF v_count >= 6 THEN
        v_score := 100;
      ELSIF v_count > 0 THEN
        v_score := (v_count * 100 / 6);
      ELSE
        v_score := 0;
      END IF;
      
    WHEN 'skills' THEN
      -- Check if user has skills
      SELECT COUNT(*) INTO v_count
      FROM skills
      WHERE user_id = p_user_id;
      
      IF v_count >= 5 THEN
        v_score := 100;
      ELSIF v_count > 0 THEN
        v_score := (v_count * 100 / 5);
      ELSE
        v_score := 0;
      END IF;
      
    WHEN 'story' THEN
      -- Check if user has a story
      SELECT CASE WHEN COUNT(*) > 0 THEN 100 ELSE 0 END
      INTO v_score
      FROM stories
      WHERE user_id = p_user_id;
      
    WHEN 'timeline' THEN
      -- Check if user has work experiences
      SELECT CASE WHEN COUNT(*) > 0 THEN 100 ELSE 0 END
      INTO v_score
      FROM work_experiences
      WHERE user_id = p_user_id;
      
    WHEN 'images' THEN
      -- Check if user has generated images
      SELECT CASE WHEN COUNT(*) >= 4 THEN 100 ELSE (COUNT(*) * 100 / 4) END
      INTO v_score
      FROM image_generations
      WHERE user_id = p_user_id AND status = 'upscaled';
      
    ELSE
      v_score := 0;
  END CASE;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. FUNCTION: UPDATE COMPLETENESS FOR USER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_completeness(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_section TEXT;
  v_score SMALLINT;
BEGIN
  -- Update completeness for all sections
  FOREACH v_section IN ARRAY ARRAY['navigation', 'logos', 'achievements', 'skills', 'story', 'timeline', 'images']
  LOOP
    v_score := get_completeness_score(p_user_id, v_section);
    
    INSERT INTO completeness (user_id, section, coverage_score, created_at)
    VALUES (p_user_id, v_section, v_score, NOW())
    ON CONFLICT (user_id, section) 
    DO UPDATE SET coverage_score = v_score, created_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNCTION: CREATE DEFAULT TENANT AND USER
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_with_tenant(
  p_user_id UUID,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Create a default tenant for the user
  INSERT INTO tenants (name, created_at)
  VALUES (COALESCE(p_email, 'Default Tenant'), NOW())
  RETURNING id INTO v_tenant_id;
  
  -- Create the user
  INSERT INTO users (id, tenant_id, email, first_name, last_name, created_at, updated_at)
  VALUES (p_user_id, v_tenant_id, p_email, p_first_name, p_last_name, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. SEED DATA: ROLE LIBRARY (SAMPLE ENTRIES)
-- ============================================================================

INSERT INTO role_library (role_slug, industry_slug, outcomes, processes, tools, writing_patterns, metric_ladders, version)
VALUES
  (
    'project_manager',
    'tech',
    ARRAY[
      'Delivered projects on time and within budget',
      'Improved cross-functional collaboration',
      'Reduced project delivery time',
      'Increased stakeholder satisfaction'
    ],
    ARRAY[
      'Agile/Scrum methodology',
      'Risk management',
      'Stakeholder communication',
      'Resource allocation'
    ],
    ARRAY['Jira', 'Asana', 'Confluence', 'Slack', 'Microsoft Project'],
    ARRAY[
      '{Outcome} by {Method} for {Audience}',
      'Led {Number} {Projects} resulting in {Impact}',
      'Implemented {Process} that improved {Metric} by {Percentage}'
    ],
    '{"budget_ranges": [["1M", "5M", "multi-million"], ["5M", "50M", "tens of millions"]], "team_sizes": [["5", "15", "small team"], ["15", "50", "mid-sized team"], ["50", "200", "large team"]]}'::jsonb,
    1
  ),
  (
    'communications_lead',
    'fintech',
    ARRAY[
      'Coordinated product launches across multiple channels',
      'Developed crisis communication playbooks',
      'Improved internal stakeholder alignment',
      'Enhanced brand visibility'
    ],
    ARRAY[
      'Content strategy',
      'Stakeholder management',
      'Brand messaging',
      'Crisis communication'
    ],
    ARRAY['Slack', 'Notion', 'Mailchimp', 'Hootsuite', 'Google Analytics'],
    ARRAY[
      'Drove {Outcome} through {Method}',
      'Coordinated {Number} {Initiatives} for {Audience}',
      'Developed {Asset} that {Impact}'
    ],
    '{"campaign_counts": [["5", "20", "dozens"], ["20", "100", "scores"], ["100", "500", "hundreds"]], "reach": [["1000", "10000", "thousands"], ["10000", "100000", "tens of thousands"], ["100000", "1000000", "hundreds of thousands"]]}'::jsonb,
    1
  ),
  (
    'brand_strategist',
    'marketing',
    ARRAY[
      'Developed comprehensive brand guidelines',
      'Increased brand awareness',
      'Improved brand consistency across channels',
      'Drove customer engagement'
    ],
    ARRAY[
      'Brand positioning',
      'Market research',
      'Visual identity design',
      'Campaign strategy'
    ],
    ARRAY['Figma', 'Adobe Creative Suite', 'Miro', 'Google Analytics', 'Brandwatch'],
    ARRAY[
      'Created {Asset} that resulted in {Impact}',
      'Led {Number} {Initiatives} driving {Outcome}',
      'Developed {Strategy} improving {Metric}'
    ],
    '{"engagement_lift": [["5", "15", "single-digit"], ["15", "30", "double-digit"], ["30", "100", "significant"]], "campaigns": [["3", "10", "several"], ["10", "30", "dozens"], ["30", "100", "scores"]]}'::jsonb,
    1
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS & SEED DATA COMPLETE
-- ============================================================================
