import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import {
  generateStoryOpener,
  generateNarrativeParagraphs,
  generateInspirationalQuote,
} from '../llm/openai.service';

/**
 * Story Pipeline - Generate narrative content for portfolio
 * Creates opener, narrative paragraphs, and inspirational quote
 */
export async function runStoryPipeline(userId: string): Promise<void> {
  try {
    logger.info('Starting story pipeline', { userId });

    // Get user's work experiences and achievements
    const { data: workExperiences } = await supabase
      .from('work_experiences')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!workExperiences || workExperiences.length === 0) {
      logger.warn('No work experiences found for story generation', { userId });
      return;
    }

    // Determine user role from most recent position
    const currentRole = workExperiences[0]?.role_title || 'Professional';
    const industry = determineIndustry(workExperiences);

    // Generate story opener
    const achievementTexts = achievements?.map((a) => a.impact_statement || a.raw_text) || [];
    const opener = await generateStoryOpener(currentRole, achievementTexts);

    // Generate narrative paragraphs
    const narrativeParagraphs = await generateNarrativeParagraphs(currentRole, workExperiences);

    // Generate inspirational quote
    const { quote, attribution } = await generateInspirationalQuote(currentRole, industry);

    // Check if story already exists
    const { data: existing } = await supabase
      .from('stories')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing story
      await supabase
        .from('stories')
        .update({
          opener,
          narrative_paragraphs: narrativeParagraphs,
          quote,
          quote_attribution: attribution,
        })
        .eq('id', existing.id);
    } else {
      // Create new story
      await supabase.from('stories').insert({
        user_id: userId,
        opener,
        narrative_paragraphs: narrativeParagraphs,
        quote,
        quote_attribution: attribution,
      });
    }

    logger.info('Story pipeline completed', {
      userId,
      opener: opener.substring(0, 50) + '...',
      paragraphCount: narrativeParagraphs.length,
    });
  } catch (error) {
    logger.error('Story pipeline failed', { userId, error });
    throw error;
  }
}

/**
 * Determine industry from work experiences
 */
function determineIndustry(workExperiences: any[]): string {
  // Simple heuristic: look for common industry keywords
  const allText = workExperiences
    .map((exp) => `${exp.company_name} ${exp.role_title} ${exp.description || ''}`)
    .join(' ')
    .toLowerCase();

  const industries = {
    technology: ['software', 'tech', 'developer', 'engineer', 'data', 'ai', 'cloud'],
    finance: ['finance', 'banking', 'investment', 'trading', 'fintech'],
    healthcare: ['health', 'medical', 'pharma', 'biotech', 'clinical'],
    consulting: ['consulting', 'consultant', 'advisory', 'strategy'],
    marketing: ['marketing', 'brand', 'advertising', 'digital marketing'],
    education: ['education', 'teaching', 'academic', 'university'],
  };

  for (const [industry, keywords] of Object.entries(industries)) {
    if (keywords.some((keyword) => allText.includes(keyword))) {
      return industry;
    }
  }

  return 'business'; // Default
}
