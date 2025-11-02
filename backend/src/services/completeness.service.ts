import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Completeness Service - Implements HEF (Honest Embellishment Framework)
 * Calculates section completeness scores and determines fill strategies
 */

export interface CompletenessScore {
  section: string;
  score: number;
  strategy: 'complete' | 'polish' | 'context' | 'qualitative' | 'template' | 'hide';
  missingFields: string[];
}

/**
 * Calculate completeness for all sections
 */
export async function calculateAllCompleteness(userId: string): Promise<CompletenessScore[]> {
  const scores: CompletenessScore[] = [];

  scores.push(await calculateImagesCompleteness(userId));
  scores.push(await calculateAchievementsCompleteness(userId));
  scores.push(await calculateLogosCompleteness(userId));
  scores.push(await calculateWorkExperienceCompleteness(userId));
  scores.push(await calculateSkillsCompleteness(userId));
  scores.push(await calculateStoryCompleteness(userId));

  // Save to database
  for (const scoreData of scores) {
    await saveCompletenessScore(userId, scoreData);
  }

  return scores;
}

/**
 * Calculate images section completeness
 */
export async function calculateImagesCompleteness(userId: string): Promise<CompletenessScore> {
  try {
    const { data: placements } = await supabase
      .from('image_placements')
      .select('placement')
      .eq('user_id', userId);

    const requiredPlacements = ['hero', 'achievements_general_main', 'achievements_career_main', 'certifications_bg'];
    const existingPlacements = placements?.map((p) => p.placement) || [];
    const missingFields = requiredPlacements.filter((p) => !existingPlacements.includes(p));

    const score = existingPlacements.length / requiredPlacements.length;
    const strategy = determineStrategy(score);

    return {
      section: 'images',
      score,
      strategy,
      missingFields,
    };
  } catch (error) {
    logger.error('Failed to calculate images completeness', { userId, error });
    return { section: 'images', score: 0, strategy: 'hide', missingFields: [] };
  }
}

/**
 * Calculate achievements section completeness
 */
export async function calculateAchievementsCompleteness(userId: string): Promise<CompletenessScore> {
  try {
    // Get achievements via work_experiences (achievements don't have user_id directly)
    const { data: workExps } = await supabase
      .from('work_experiences')
      .select('id')
      .eq('user_id', userId);

    if (!workExps || workExps.length === 0) {
      return { section: 'achievements', score: 0, strategy: 'template', missingFields: ['work_experiences'] };
    }

    const workExpIds = workExps.map((we) => we.id);

    const { data: achievements } = await supabase
      .from('achievements')
      .select('id, raw_text, metric_value_numeric, metric_unit, impact_statement')
      .in('work_experience_id', workExpIds);

    if (!achievements || achievements.length === 0) {
      return { section: 'achievements', score: 0, strategy: 'template', missingFields: ['achievements'] };
    }

    // Calculate completeness based on:
    // - Number of achievements (target: 6)
    // - Percentage with metrics
    // - Percentage with impact statements

    const targetCount = 6;
    const countScore = Math.min(achievements.length / targetCount, 1.0);
    
    const withMetrics = achievements.filter((a) => a.metric_value_numeric && a.metric_unit).length;
    const metricsScore = achievements.length > 0 ? withMetrics / achievements.length : 0;
    
    const withImpact = achievements.filter((a) => a.impact_statement).length;
    const impactScore = achievements.length > 0 ? withImpact / achievements.length : 0;

    // Weighted average
    const score = countScore * 0.4 + metricsScore * 0.4 + impactScore * 0.2;
    const strategy = determineStrategy(score);

    const missingFields: string[] = [];
    if (achievements.length < targetCount) missingFields.push('more_achievements');
    if (metricsScore < 0.5) missingFields.push('metrics');
    if (impactScore < 0.5) missingFields.push('impact_statements');

    return {
      section: 'achievements',
      score,
      strategy,
      missingFields,
    };
  } catch (error) {
    logger.error('Failed to calculate achievements completeness', { userId, error });
    return { section: 'achievements', score: 0, strategy: 'hide', missingFields: [] };
  }
}

/**
 * Calculate logos section completeness
 */
export async function calculateLogosCompleteness(userId: string): Promise<CompletenessScore> {
  try {
    // Get companies the user has worked at (via work_experiences)
    const { data: exps } = await supabase
      .from('work_experiences')
      .select('company_id')
      .eq('user_id', userId);

    const companyIds = [...new Set((exps || []).map((e) => e.company_id).filter(Boolean))];

    if (companyIds.length === 0) {
      return { section: 'logos', score: 0, strategy: 'hide', missingFields: ['companies'] };
    }

    // Check how many have logo assets
    const { data: logoLinks } = await supabase
      .from('company_assets')
      .select('company_id')
      .in('company_id', companyIds);

    const withLogos = new Set((logoLinks || []).map((l) => l.company_id));
    const score = withLogos.size / companyIds.length;
    const strategy = determineStrategy(score);

    const missingFields = score < 1.0 ? ['logos'] : [];

    return {
      section: 'logos',
      score,
      strategy,
      missingFields,
    };
  } catch (error) {
    logger.error('Failed to calculate logos completeness', { userId, error });
    return { section: 'logos', score: 0, strategy: 'hide', missingFields: [] };
  }
}

/**
 * Calculate work experience completeness
 */
export async function calculateWorkExperienceCompleteness(userId: string): Promise<CompletenessScore> {
  try {
    const { data: experiences } = await supabase
      .from('work_experiences')
      .select('id, company_name, role_title, start_date, end_date, description')
      .eq('user_id', userId);

    if (!experiences || experiences.length === 0) {
      return { section: 'work_experience', score: 0, strategy: 'template', missingFields: ['work_experiences'] };
    }

    // Check completeness of each experience
    let totalScore = 0;
    const missingFields: string[] = [];

    for (const exp of experiences) {
      let expScore = 0;
      if (exp.company_name) expScore += 0.25;
      if (exp.role_title) expScore += 0.25;
      if (exp.start_date) expScore += 0.25;
      if (exp.description) expScore += 0.25;
      totalScore += expScore;
    }

    const score = totalScore / experiences.length;
    const strategy = determineStrategy(score);

    if (score < 0.8) missingFields.push('incomplete_fields');

    return {
      section: 'work_experience',
      score,
      strategy,
      missingFields,
    };
  } catch (error) {
    logger.error('Failed to calculate work experience completeness', { userId, error });
    return { section: 'work_experience', score: 0, strategy: 'hide', missingFields: [] };
  }
}

/**
 * Calculate skills completeness
 */
export async function calculateSkillsCompleteness(userId: string): Promise<CompletenessScore> {
  try {
    const { data: skills } = await supabase
      .from('skills')
      .select('id, skill_name, category, proficiency')
      .eq('user_id', userId);

    if (!skills || skills.length === 0) {
      return { section: 'skills', score: 0, strategy: 'template', missingFields: ['skills'] };
    }

    const targetCount = 8;
    const score = Math.min(skills.length / targetCount, 1.0);
    const strategy = determineStrategy(score);

    const missingFields = skills.length < targetCount ? ['more_skills'] : [];

    return {
      section: 'skills',
      score,
      strategy,
      missingFields,
    };
  } catch (error) {
    logger.error('Failed to calculate skills completeness', { userId, error });
    return { section: 'skills', score: 0, strategy: 'hide', missingFields: [] };
  }
}

/**
 * Calculate story completeness
 */
export async function calculateStoryCompleteness(userId: string): Promise<CompletenessScore> {
  try {
    const { data: story } = await supabase
      .from('stories')
      .select('opener, narrative_paragraphs, quote, quote_attribution')
      .eq('user_id', userId)
      .single();

    if (!story) {
      return { section: 'story', score: 0, strategy: 'qualitative', missingFields: ['story'] };
    }

    let score = 0;
    const missingFields: string[] = [];

    if (story.opener) score += 0.3;
    else missingFields.push('opener');

    if (story.narrative_paragraphs && story.narrative_paragraphs.length > 0) score += 0.4;
    else missingFields.push('narrative');

    if (story.quote) score += 0.3;
    else missingFields.push('quote');

    const strategy = determineStrategy(score);

    return {
      section: 'story',
      score,
      strategy,
      missingFields,
    };
  } catch (error) {
    logger.error('Failed to calculate story completeness', { userId, error });
    return { section: 'story', score: 0, strategy: 'qualitative', missingFields: [] };
  }
}

/**
 * Determine fill strategy based on completeness score
 * Implements HEF decision logic
 */
function determineStrategy(score: number): CompletenessScore['strategy'] {
  if (score >= 0.9) return 'complete'; // No action needed
  if (score >= 0.7) return 'polish'; // Minor improvements
  if (score >= 0.5) return 'context'; // Add context from industry knowledge
  if (score >= 0.3) return 'qualitative'; // Qualitative descriptions
  if (score > 0) return 'template'; // Use templates
  return 'hide'; // Hide section entirely
}

/**
 * Save completeness score to database
 */
async function saveCompletenessScore(userId: string, scoreData: CompletenessScore): Promise<void> {
  try {
    // Check if record exists
    const { data: existing } = await supabase
      .from('completeness')
      .select('id')
      .eq('user_id', userId)
      .eq('section', scoreData.section)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from('completeness')
        .update({
          score: scoreData.score,
          strategy: scoreData.strategy,
          missing_fields: scoreData.missingFields,
        })
        .eq('id', existing.id);
    } else {
      // Insert new
      await supabase.from('completeness').insert({
        user_id: userId,
        section: scoreData.section,
        score: scoreData.score,
        strategy: scoreData.strategy,
        missing_fields: scoreData.missingFields,
      });
    }

    logger.info('Saved completeness score', {
      userId,
      section: scoreData.section,
      score: scoreData.score,
      strategy: scoreData.strategy,
    });
  } catch (error) {
    logger.error('Failed to save completeness score', { userId, section: scoreData.section, error });
  }
}
