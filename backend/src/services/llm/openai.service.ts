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

/**
 * Structure resume content into work experiences, achievements, and skills
 */
export async function structureResumeContent(resumeText: string): Promise<{
  workExperiences: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    description?: string;
  }>;
  achievements: Array<{
    text: string;
    metricValue?: number;
    metricUnit?: string;
    scope?: string;
  }>;
  skills: Array<{
    name: string;
    category?: string;
    proficiency?: string;
  }>;
}> {
  try {
    const prompt = `Extract structured information from this resume text.

Resume:
${resumeText}

Extract and return a JSON object with:
1. workExperiences: array of jobs with company, title, startDate (YYYY-MM), endDate (YYYY-MM or null if current), isCurrent (boolean), description
2. achievements: array of accomplishments with text, metricValue (number if quantified), metricUnit (e.g., "percent", "million", "users"), scope (e.g., "company-wide", "team")
3. skills: array of skills with name, category (e.g., "technical", "leadership"), proficiency (e.g., "expert", "intermediate")

Focus on extracting quantified achievements with specific metrics. Be precise with dates and numbers.

Return ONLY valid JSON, no additional text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume parser. Extract structured data accurately and return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for accuracy
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content?.trim() || '{}';
    const structured = JSON.parse(content);

    return {
      workExperiences: structured.workExperiences || [],
      achievements: structured.achievements || [],
      skills: structured.skills || [],
    };
  } catch (error) {
    logger.error('Failed to structure resume content:', error);
    // Return empty structure on error
    return {
      workExperiences: [],
      achievements: [],
      skills: [],
    };
  }
}

/**
 * Generate enhanced impact statement for achievement
 * Preserves numeric metrics while improving clarity
 */
export async function generateImpactStatement(rawText: string): Promise<string> {
  try {
    const prompt = `Enhance this achievement statement while preserving all numeric metrics exactly as written.

Original: ${rawText}

Rules:
1. Keep all numbers, percentages, and metrics EXACTLY as they appear
2. Improve clarity and professional tone
3. Use action verbs (led, implemented, increased, reduced, etc.)
4. Make it concise (max 2 sentences)
5. Focus on business impact

Return only the enhanced statement, no explanation.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at writing professional achievement statements. Always preserve exact numeric values.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    return response.choices[0].message.content?.trim() || rawText;
  } catch (error) {
    logger.error('Failed to generate impact statement:', error);
    return rawText; // Return original on error
  }
}

/**
 * Generate skill offers - Transform skills into client-ready offerings
 */
export async function generateSkillOffers(
  category: string,
  skillNames: string[],
  achievements: any[]
): Promise<Array<{
  skillName: string;
  offerStatement: string;
  proofPoints: string[];
}>> {
  try {
    const prompt = `Transform these ${category} skills into client-ready service offerings.

Skills: ${skillNames.join(', ')}

Related achievements:
${achievements.map((a) => a.impact_statement || a.raw_text).join('\n')}

For each skill, create:
1. offerStatement: A compelling 1-sentence description of what you can deliver (client-focused, not skill-focused)
2. proofPoints: 2-3 specific examples or metrics from the achievements that prove this capability

Example format:
{
  "offers": [
    {
      "skillName": "React",
      "offerStatement": "Build scalable web applications that handle millions of users with modern, maintainable code",
      "proofPoints": [
        "Rebuilt platform serving 2M+ users with 40% faster load times",
        "Reduced bug reports by 60% through component testing"
      ]
    }
  ]
}

Return ONLY valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at translating technical skills into business value propositions.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content?.trim() || '{}';
    const parsed = JSON.parse(content);

    return parsed.offers || [];
  } catch (error) {
    logger.error('Failed to generate skill offers:', error);
    // Return basic offers on error
    return skillNames.map((skillName) => ({
      skillName,
      offerStatement: `Expertise in ${skillName}`,
      proofPoints: [],
    }));
  }
}
