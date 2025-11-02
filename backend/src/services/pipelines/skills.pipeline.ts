import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { generateSkillOffers } from '../llm/openai.service';

/**
 * Skills Pipeline - Transform skills into client-ready offerings
 * Creates skill_offers with proof points
 */
export async function runSkillsPipeline(userId: string): Promise<void> {
  try {
    logger.info('Starting skills pipeline', { userId });

    // Get user's skills
    const { data: skills } = await supabase
      .from('skills')
      .select('*')
      .eq('user_id', userId);

    if (!skills || skills.length === 0) {
      logger.warn('No skills found for skills pipeline', { userId });
      return;
    }

    // Get achievements for proof points
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId);

    // Group skills by category
    const skillsByCategory = groupSkillsByCategory(skills);

    // Generate skill offers for each category
    for (const [category, categorySkills] of Object.entries(skillsByCategory)) {
      const skillNames = categorySkills.map((s) => s.skill_name);
      const relevantAchievements = findRelevantAchievements(skillNames, achievements || []);

      // Generate client-ready offerings
      const offers = await generateSkillOffers(category, skillNames, relevantAchievements);

      // Save skill offers
      for (const offer of offers) {
        // Check if offer already exists
        const { data: existing } = await supabase
          .from('skill_offers')
          .select('id')
          .eq('user_id', userId)
          .eq('skill_name', offer.skillName)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from('skill_offers')
            .update({
              offer_statement: offer.offerStatement,
              proof_points: offer.proofPoints,
              category,
            })
            .eq('id', existing.id);
        } else {
          // Create new
          await supabase.from('skill_offers').insert({
            user_id: userId,
            skill_name: offer.skillName,
            offer_statement: offer.offerStatement,
            proof_points: offer.proofPoints,
            category,
          });
        }
      }
    }

    logger.info('Skills pipeline completed', {
      userId,
      skillsProcessed: skills.length,
      categories: Object.keys(skillsByCategory).length,
    });
  } catch (error) {
    logger.error('Skills pipeline failed', { userId, error });
    throw error;
  }
}

/**
 * Group skills by category
 */
function groupSkillsByCategory(skills: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const skill of skills) {
    const category = skill.category || 'general';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(skill);
  }

  return grouped;
}

/**
 * Find achievements relevant to given skills
 */
function findRelevantAchievements(skillNames: string[], achievements: any[]): any[] {
  const relevant: any[] = [];

  for (const achievement of achievements) {
    const text = (achievement.impact_statement || achievement.raw_text || '').toLowerCase();
    
    // Check if any skill name appears in the achievement text
    for (const skillName of skillNames) {
      if (text.includes(skillName.toLowerCase())) {
        relevant.push(achievement);
        break;
      }
    }
  }

  return relevant.slice(0, 5); // Limit to top 5
}
