// ============================================================================
// SHARED TYPES - Used across frontend and backend
// ============================================================================

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userRole?: string;
  photoUrl?: string;
  headline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export interface Document {
  id: string;
  userId: string;
  type: 'resume_pdf' | 'resume_docx' | 'linkedin' | 'manual';
  storageUrl: string;
  textExtracted?: string;
  createdAt: string;
}

export interface WorkExperience {
  id: string;
  userId: string;
  companyId?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  id: string;
  workExperienceId: string;
  sourceDocumentId?: string;
  rawText: string;
  metricValueNumeric?: number;
  metricUnit?: string;
  metricLabel?: string;
  impactStatement?: string;
  evidenceStrength: number;
  verified: boolean;
  provenance: 'user_provided' | 'model_context' | 'industry_template';
  confidence: number;
  requiresReview: boolean;
  isPlaceholder: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AchievementRanking {
  id: string;
  userId: string;
  label: string;
  items: any; // JSONB
  scoring?: any; // JSONB
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  userId: string;
  name: string;
  level?: string;
  createdAt: string;
}

export interface SkillOffer {
  id: string;
  userId: string;
  skillId: string;
  offerSummary?: string;
  proofPoints?: string[];
  rank?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Story {
  id: string;
  userId: string;
  opener?: string;
  narrativeParagraphs?: string[];
  quote?: string;
  quoteAttribution?: string;
  purpose?: string;
  ctaLabel?: string;
  ctaHref?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  tenantId: string;
  canonicalName: string;
  altNames?: string[];
  website?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  tenantId: string;
  userId: string;
  kind: 'logo_svg' | 'logo_png' | 'nameplate_svg' | 'resume_pdf' | 
        'portrait_src' | 'portrait_upscaled' | 'banner_generated' |
        'feature_square_generated' | 'card_portrait_generated' |
        'cert_banner_generated' | 'subject_mask' | 'other';
  label?: string;
  storageUrl: string;
  variant?: any; // JSONB
  source?: string;
  checksum?: string;
  createdAt: string;
}

export interface ImageGeneration {
  id: string;
  userId: string;
  sourceAssetId?: string;
  model?: string;
  archetype: 'hero' | 'formal' | 'desk' | 'casual';
  seed?: string;
  prompt?: string;
  negativePrompt?: string;
  likenessScore?: number;
  artifactScore?: number;
  framingScore?: number;
  styleScore?: number;
  finalScore?: number;
  status: 'generated' | 'upscaled' | 'failed';
  generatedAssetId?: string;
  upscaledAssetId?: string;
  maskAssetId?: string;
  metadata?: any; // JSONB
  createdAt: string;
}

export interface ImagePlacement {
  id: string;
  userId: string;
  siteVersionId: string;
  placement: 'hero' | 'achievements_general_main' | 'achievements_career_main' | 'certifications_bg';
  assetId?: string;
  crop?: any; // JSONB
  gradient?: any; // JSONB
  chosenBy: 'system' | 'user';
  createdAt: string;
}

export interface SiteSettings {
  id: string;
  userId: string;
  subdomain?: string;
  theme?: any; // JSONB
  publishedVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteVersion {
  id: string;
  userId: string;
  careerGraphSnapshot: any; // JSONB
  buildStatus: 'draft' | 'building' | 'published' | 'failed';
  previewUrl?: string;
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRun {
  id: string;
  userId: string;
  kind: 'ingest' | 'logos' | 'achievements' | 'skills' | 'story' | 'timeline' | 'navigation' | 'images' | 'render' | 'export';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  input?: any; // JSONB
  output?: any; // JSONB
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Completeness {
  id: string;
  userId: string;
  section: 'navigation' | 'logos' | 'achievements' | 'skills' | 'story' | 'timeline' | 'images';
  coverageScore: number;
  missingFields?: string[];
  decidedStrategy?: 'polish' | 'context' | 'qualitative' | 'template' | 'hide';
  createdAt: string;
}

export interface RoleLibrary {
  id: string;
  roleSlug: string;
  industrySlug?: string;
  outcomes?: string[];
  processes?: string[];
  tools?: string[];
  writingPatterns?: string[];
  metricLadders?: any; // JSONB
  version: number;
  createdAt: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SignupResponse {
  userId: string;
  email: string;
  firstName: string;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: string;
  token: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  userRole?: string;
  photoUrl?: string;
  headline?: string;
}

export interface UploadDocumentResponse {
  documentId: string;
  pipelineRunId: string;
  status: string;
  message: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

// ============================================================================
// PIPELINE TYPES
// ============================================================================

export interface IngestPipelineInput {
  documentId: string;
}

export interface IngestPipelineOutput {
  extractedText: string;
  workExperiencesCreated: number;
  achievementsCreated: number;
  skillsCreated: number;
}

export interface LogoPipelineInput {
  companyName: string;
}

export interface LogoPipelineOutput {
  logoUrl?: string;
  source: 'brandfetch' | 'logo.dev' | 'ideogram' | 'fallback';
}

export interface AchievementPipelineInput {
  userId: string;
}

export interface AchievementPipelineOutput {
  topAchievements: Achievement[];
  rankingId: string;
}

export interface ImagePipelineInput {
  userId: string;
  sourcePhotoUrl: string;
}

export interface ImagePipelineOutput {
  generations: ImageGeneration[];
  placements: ImagePlacement[];
}

export interface StoryPipelineInput {
  userId: string;
}

export interface StoryPipelineOutput {
  storyId: string;
  opener: string;
  narrativeParagraphs: string[];
  quote: string;
}
