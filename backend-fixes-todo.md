# Backend Fixes TODO - Based on PRD Audit

## P0 - Critical Issues (Must Fix First)

### Image Pipeline
- [x] Fix archetype to placement mapping (hero, formal, desk, casual)
- [x] Fix aspect ratios per archetype (16:9, 1:1, 4:5, 21:9)
- [x] Update prompts to match correct aspect ratios
- [x] Implement correct Asset.kind per placement (banner_generated, feature_square_generated, card_portrait_generated, cert_banner_generated)
- [x] Add image scoring (likeness, artifact, framing, style)
- [x] Add upscaling step (placeholder ready)
- [x] Write to image_placements table with crop and gradient data
- [x] Fix saveImageAsset to accept kind parameter

### Bull Queue Orchestration
- [x] Install Bull and Redis dependencies
- [x] Create queue/pipeline.ts with Bull queue setup
- [x] Create worker process for pipeline jobs
- [x] Add POST /pipelines/run endpoint
- [x] Update pipeline_runs status in real-time
- [x] Queue ingest, logos, images, achievements pipelines

### Achievements Scoring
- [x] Implement deterministic scoring function from PRD
- [x] Write achievement_rankings table
- [x] Add LLM rewrite step that preserves numeric tokens
- [x] Implement qualitative fallback for missing metrics
- [x] Update achievements with impact_statement, provenance, confidence

### Completeness Calculation
- [ ] Compute completeness for images section (TODO in P1)
- [ ] Compute completeness for achievements section (TODO in P1)
- [ ] Compute completeness for logos section (TODO in P1)
- [ ] Store results in completeness table (TODO in P1)

## P1 - Important Issues

### Ingestion Structuring
- [ ] Add LLM pass to extract work_experiences from resume text
- [ ] Extract achievements with raw_text and metrics
- [ ] Extract skills from resume
- [ ] Mark provenance appropriately
- [ ] Set requires_review flags

### HEF/CVE Implementation
- [ ] Implement coverage → strategy → variant decision logic
- [ ] Add calculate_section_completeness calls
- [ ] Store strategy decisions for renderer
- [ ] Implement polish/qualitative/template strategies

### Story Pipeline
- [ ] Persist generated stories to stories table
- [ ] Add opener, paragraphs, purpose, CTA fields
- [ ] Implement editor fields support

## P2 - Nice to Have

### Timeline
- [ ] Create pipeline to normalize roles
- [ ] Generate timeline entries from work_experiences

### Renderer/Publish
- [ ] Create Next.js SSG app
- [ ] Implement ISR (Incremental Static Regeneration)
- [ ] Add PDF export functionality
- [ ] Save site_versions snapshots
- [ ] Generate public URLs

### Analytics
- [ ] Add collector endpoint for events
- [ ] Create minimal dashboard

### Security
- [ ] Add RLS policies (rls.sql migration)
- [ ] Enable RLS in Supabase
- [ ] Scope policies properly
- [ ] Keep service key server-side only

## New API Endpoints Needed

- [ ] POST /pipelines/run - Start pipeline execution
- [ ] POST /images/reroll - Rerun one archetype
- [ ] POST /images/placements - User selects different variant
- [ ] GET /career-graph - Return complete career graph snapshot

## Documentation Updates

- [ ] Regenerate docs/api_spec_users_documents.md
- [ ] Add pipeline run POST documentation
- [ ] Update README with new endpoints

## Code Quality Issues

- [ ] Fix OpenAI types - rankAchievements signature inconsistency
- [ ] Align achievement object types across codebase
- [ ] Add rate limiting to auth endpoints
- [ ] Add audit logs
