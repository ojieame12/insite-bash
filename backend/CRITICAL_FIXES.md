# Critical Fixes from Audit

## P0 - Schema Mismatches (Will Break at Runtime)

### 1. Ingestion Pipeline
- [x] Fix work_experiences insert (use company_id, title instead of company_name, role_title)
- [x] Add getOrCreateCompanyId helper function
- [x] Fix achievements insert (use work_experience_id, metric_value_numeric, metric_label)
- [x] Link achievements to work experiences

### 2. Completeness Service
- [x] Fix logos completeness (join via work_experiences, use canonical_name)
- [x] Remove user_id query from companies table
- [x] Fix achievements query to join through work_experiences

### 3. Story Pipeline
- [x] Fix column name: role_title → title
- [x] Fix achievements query to join through work_experiences

### 4. Image Pipeline
- [x] Fix site_versions insert (add career_graph_snapshot)
- [x] Remove version_number field

### 5. Logos Pipeline
- [x] Implement logo persistence to assets table
- [x] Create company_assets links
- [x] Add Brandfetch/Logo.dev/Ideogram fallback chain
- [x] Download and upload to Supabase Storage
- [x] Integrate with worker

## P1 - Missing Features

- [x] Add GET /career-graph API endpoint
- [x] Add public career graph endpoint
- [ ] Remove ... placeholders from queue files (if any)
- [ ] Add rate limiting middleware (future enhancement)
