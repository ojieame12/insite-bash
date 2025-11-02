import OpenAI from 'openai';
import { logger } from '../../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate story opener using Claude/GPT
 */
export async function generateStoryOpener(
  userRole: string,
  achievements: string[]
): Promise<string> {
  try {
    const prompt = `You are a professional copywriter creating a compelling one-liner opener 
    for a portfolio website. The person is a ${userRole} with these key achievements:
    
    ${achievements.join('\n')}
    
    Create a single, powerful sentence (max 15 words) that captures their impact and expertise.
    Make it confident but not arrogant, specific but not jargon-heavy.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are an expert portfolio copywriter.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return response.choices[0].message.content?.trim() || '';
  } catch (error) {
    logger.error('Failed to generate story opener:', error);
    throw error;
  }
}

/**
 * Generate narrative paragraphs for story section
 */
export async function generateNarrativeParagraphs(
  userRole: string,
  workExperiences: any[]
): Promise<string[]> {
  try {
    const prompt = `Create 2-3 compelling narrative paragraphs for a ${userRole}'s portfolio story section.
    
    Work experience:
    ${JSON.stringify(workExperiences, null, 2)}
    
    Write in first person, focus on impact and growth, be specific with examples.
    Each paragraph should be 3-4 sentences.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are an expert portfolio copywriter.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content?.trim() || '';
    return content.split('\n\n').filter(p => p.length > 0);
  } catch (error) {
    logger.error('Failed to generate narrative paragraphs:', error);
    throw error;
  }
}

/**
 * Generate inspirational quote
 */
export async function generateInspirationalQuote(
  userRole: string,
  industry: string
): Promise<{ quote: string; attribution: string }> {
  try {
    const prompt = `Generate an inspirational quote relevant to a ${userRole} in ${industry}.
    The quote should be motivational, professional, and resonate with their career journey.
    Format: "Quote text" - Attribution`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a quote curator for professional portfolios.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 100,
      temperature: 0.8,
    });

    const content = response.choices[0].message.content?.trim() || '';
    const [quote, attribution] = content.split(' - ');

    return {
      quote: quote.replace(/"/g, '').trim(),
      attribution: attribution?.trim() || 'Unknown',
    };
  } catch (error) {
    logger.error('Failed to generate quote:', error);
    throw error;
  }
}

/**
 * Rank achievements using LLM
 */
export async function rankAchievements(
  achievements: any[]
): Promise<any[]> {
  try {
    const prompt = `Rank these achievements from most to least impressive, considering:
    - Metric strength (quantified impact)
    - Scope (organization size, reach)
    - Complexity
    - Business value
    
    Achievements:
    ${JSON.stringify(achievements, null, 2)}
    
    Return only the achievement IDs in ranked order as a JSON array.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are an expert at evaluating professional achievements.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content?.trim() || '[]';
    const rankedIds = JSON.parse(content);

    // Reorder achievements based on ranking
    return rankedIds.map((id: string) =>
      achievements.find(a => a.id === id)
    ).filter(Boolean);
  } catch (error) {
    logger.error('Failed to rank achievements:', error);
    return achievements; // Return original order on error
  }
}
