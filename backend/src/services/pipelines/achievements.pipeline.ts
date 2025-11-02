import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { generateImpactStatement } from '../llm/openai.service';

interface Achievement {
  id: string;
  user_id: string;
  raw_text: string;
  metric_value?: number;
  metric_unit?: string;
  scope?: string;
  impact_statement?: string;
  provenance?: string;
  confidence?: number;
}

interface ScoredAchievement extends Achievement {
  score: number;
  rank: number;
}

/**
 * Achievements Pipeline - Score, rank, and enhance achievements
 * Implements the scoring algorithm from PRD
 */
export async function runAchievementsPipeline(userId: string): Promise<void> {
  try {
    logger.info('Starting achievements pipeline', { userId });

    // 1. Fetch all achievements for user
    const { data: achievements, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    if (!achievements || achievements.length === 0) {
      logger.warn('No achievements found for user', { userId });
      return;
    }

    // 2. Score each achievement
    const scoredAchievements = achievements.map((achievement) => ({
      ...achievement,
      score: calculateAchievementScore(achievement),
      rank: 0, // Will be set after sorting
    }));

    // 3. Sort by score and assign ranks
    scoredAchievements.sort((a, b) => b.score - a.score);
    scoredAchievements.forEach((achievement, index) => {
      achievement.rank = index + 1;
    });

    // 4. Take top 6 achievements
    const topAchievements = scoredAchievements.slice(0, 6);

    // 5. Enhance with LLM if needed
    for (const achievement of topAchievements) {
      if (!achievement.impact_statement || achievement.provenance === 'user_provided') {
        // Generate enhanced impact statement
        const enhanced = await enhanceAchievement(achievement);
        
        // Update achievement with enhanced version
        await supabase
          .from('achievements')
          .update({
            impact_statement: enhanced.impact_statement,
            provenance: enhanced.provenance,
            confidence: enhanced.confidence,
            requires_review: enhanced.requires_review,
          })
          .eq('id', achievement.id);
      }
    }

    // 6. Save rankings
    await saveAchievementRankings(userId, topAchievements);

    logger.info('Achievements pipeline completed', {
      userId,
      total: achievements.length,
      ranked: topAchievements.length,
    });
  } catch (error) {
    logger.error('Achievements pipeline failed', { userId, error });
    throw error;
  }
}

/**
 * Calculate achievement score based on PRD formula
 * Score = (metric_strength * 0.4) + (scope_size * 0.3) + (evidence_strength * 0.3)
 */
function calculateAchievementScore(achievement: Achievement): number {
  // 1. Metric Strength (0-1)
  const metricStrength = calculateMetricStrength(
    achievement.metric_value,
    achievement.metric_unit
  );

  // 2. Scope Size (0-1)
  const scopeSize = calculateScopeSize(achievement.scope);

  // 3. Evidence Strength (0-1)
  const evidenceStrength = calculateEvidenceStrength(achievement);

  // Weighted sum
  const score = metricStrength * 0.4 + scopeSize * 0.3 + evidenceStrength * 0.3;

  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

function calculateMetricStrength(value?: number, unit?: string): number {
  if (!value || !unit) return 0.3; // Low score for missing metrics

  // Normalize based on unit type
  const normalizations: Record<string, { threshold: number; max: number }> = {
    percent: { threshold: 10, max: 100 },
    million: { threshold: 1, max: 100 },
    thousand: { threshold: 10, max: 1000 },
    count: { threshold: 100, max: 10000 },
    days: { threshold: 30, max: 365 },
    users: { threshold: 1000, max: 1000000 },
    revenue: { threshold: 100000, max: 10000000 },
  };

  const norm = normalizations[unit.toLowerCase()] || { threshold: 1, max: 100 };
  
  // Logarithmic scale for large numbers
  const normalized = Math.min(
    Math.log(value + 1) / Math.log(norm.max + 1),
    1.0
  );

  return Math.max(0.3, normalized); // Minimum 0.3 if metric exists
}

function calculateScopeSize(scope?: string): number {
  if (!scope) return 0.5; // Default mid-range

  const scopeLower = scope.toLowerCase();

  // Organization size indicators
  if (scopeLower.includes('fortune 500') || scopeLower.includes('enterprise')) {
    return 1.0;
  }
  if (scopeLower.includes('company-wide') || scopeLower.includes('organization')) {
    return 0.9;
  }
  if (scopeLower.includes('department') || scopeLower.includes('division')) {
    return 0.7;
  }
  if (scopeLower.includes('team') || scopeLower.includes('group')) {
    return 0.6;
  }
  if (scopeLower.includes('project') || scopeLower.includes('initiative')) {
    return 0.5;
  }

  return 0.5; // Default
}

function calculateEvidenceStrength(achievement: Achievement): number {
  let strength = 0.5; // Base score

  // Has specific metric
  if (achievement.metric_value && achievement.metric_unit) {
    strength += 0.3;
  }

  // Has scope information
  if (achievement.scope) {
    strength += 0.2;
  }

  // Text quality indicators
  if (achievement.raw_text) {
    const text = achievement.raw_text.toLowerCase();
    
    // Contains action verbs
    const actionVerbs = ['led', 'managed', 'developed', 'implemented', 'increased', 'reduced', 'improved'];
    if (actionVerbs.some((verb) => text.includes(verb))) {
      strength += 0.1;
    }

    // Contains specific details
    if (text.length > 50) {
      strength += 0.1;
    }
  }

  return Math.min(strength, 1.0);
}

async function enhanceAchievement(achievement: Achievement): Promise<{
  impact_statement: string;
  provenance: string;
  confidence: number;
  requires_review: boolean;
}> {
  try {
    // If has metrics, preserve them and polish
    if (achievement.metric_value && achievement.metric_unit) {
      const enhanced = await generateImpactStatement(achievement.raw_text);
      
      return {
        impact_statement: enhanced,
        provenance: 'model_polish',
        confidence: 0.9,
        requires_review: false,
      };
    }

    // If no metrics, use qualitative enhancement
    const enhanced = await generateImpactStatement(achievement.raw_text);
    
    return {
      impact_statement: enhanced,
      provenance: 'model_context',
      confidence: 0.7,
      requires_review: true, // Flag for review since no hard metrics
    };
  } catch (error) {
    logger.error('Failed to enhance achievement', { achievementId: achievement.id, error });
    
    // Fallback to original
    return {
      impact_statement: achievement.raw_text,
      provenance: 'user_provided',
      confidence: 1.0,
      requires_review: false,
    };
  }
}

async function saveAchievementRankings(
  userId: string,
  achievements: ScoredAchievement[]
): Promise<void> {
  try {
    // Delete existing rankings
    await supabase
      .from('achievement_rankings')
      .delete()
      .eq('user_id', userId);

    // Create items array
    const items = achievements.map((achievement) => ({
      achievement_id: achievement.id,
      rank: achievement.rank,
      score: achievement.score,
    }));

    // Create scoring object
    const scoring = {
      algorithm: 'weighted_sum_v1',
      weights: {
        metric_strength: 0.4,
        scope_size: 0.3,
        evidence_strength: 0.3,
      },
      computed_at: new Date().toISOString(),
    };

    // Insert new ranking
    await supabase.from('achievement_rankings').insert({
      user_id: userId,
      items,
      scoring,
    });

    logger.info('Saved achievement rankings', {
      userId,
      count: items.length,
    });
  } catch (error) {
    logger.error('Failed to save achievement rankings', { userId, error });
    throw error;
  }
}
