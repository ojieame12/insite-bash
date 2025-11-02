import { Document, VectorStoreIndex, OpenAI, Settings } from 'llamaindex';
import { logger } from '../../utils/logger';

// Configure LlamaIndex to use OpenAI (can be replaced with local models)
Settings.llm = new OpenAI({
  model: 'gpt-3.5-turbo',
  apiKey: process.env.OPENAI_API_KEY,
});

interface WorkExperience {
  company_name: string;
  role_title: string;
  start_date: string;
  end_date: string | null;
  description: string;
  is_current: boolean;
}

interface Achievement {
  raw_text: string;
  metric_value: number | null;
  metric_unit: string | null;
  scope: string | null;
  evidence_strength: 'strong' | 'medium' | 'weak';
}

interface Skill {
  skill_name: string;
  category: string;
  proficiency_level: 'expert' | 'advanced' | 'intermediate' | 'beginner' | null;
}

interface StructuredResume {
  work_experiences: WorkExperience[];
  achievements: Achievement[];
  skills: Skill[];
  companies: string[];
}

/**
 * Parse resume text into structured data using LlamaIndex
 * This uses LlamaIndex's structured extraction capabilities
 */
export async function parseResumeWithLlamaIndex(
  resumeText: string
): Promise<StructuredResume> {
  try {
    logger.info('Starting LlamaIndex resume parsing');

    // Create a document from the resume text
    const document = new Document({ text: resumeText });

    // Create an index from the document
    const index = await VectorStoreIndex.fromDocuments([document]);

    // Create a query engine
    const queryEngine = index.asQueryEngine();

    // Extract work experiences
    const workExpQuery = await queryEngine.query({
      query: `Extract all work experiences from this resume. For each job, provide:
- company_name (string)
- role_title (string)
- start_date (YYYY-MM format)
- end_date (YYYY-MM format or null if current)
- description (brief summary)
- is_current (boolean)

Return as JSON array.`,
    });

    // Extract achievements
    const achievementsQuery = await queryEngine.query({
      query: `Extract all quantifiable achievements from this resume. For each achievement, provide:
- raw_text (the original achievement text)
- metric_value (number if quantifiable, null otherwise)
- metric_unit (e.g., "users", "revenue", "%" or null)
- scope (company/team/project name)
- evidence_strength ("strong" if has metrics, "medium" if has context, "weak" otherwise)

Return as JSON array.`,
    });

    // Extract skills
    const skillsQuery = await queryEngine.query({
      query: `Extract all skills from this resume. For each skill, provide:
- skill_name (string)
- category (e.g., "technical", "soft", "language", "tool")
- proficiency_level ("expert", "advanced", "intermediate", "beginner", or null)

Return as JSON array.`,
    });

    // Parse the responses
    const workExperiences = parseJSONResponse(workExpQuery.toString(), []);
    const achievements = parseJSONResponse(achievementsQuery.toString(), []);
    const skills = parseJSONResponse(skillsQuery.toString(), []);

    // Extract unique company names
    const companies = [
      ...new Set(workExperiences.map((exp: WorkExperience) => exp.company_name)),
    ];

    logger.info('LlamaIndex parsing completed', {
      workExperiences: workExperiences.length,
      achievements: achievements.length,
      skills: skills.length,
      companies: companies.length,
    });

    return {
      work_experiences: workExperiences,
      achievements,
      skills,
      companies,
    };
  } catch (error) {
    logger.error('LlamaIndex parsing failed', { error });
    throw new Error(`Resume parsing failed: ${error}`);
  }
}

/**
 * Parse JSON from LLM response, with fallback
 */
function parseJSONResponse(response: string, fallback: any = []): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Try parsing the entire response
    return JSON.parse(response);
  } catch (error) {
    logger.warn('Failed to parse JSON response, using fallback', { error });
    return fallback;
  }
}

/**
 * Alternative: Use LlamaIndex with local models (Ollama)
 * Uncomment this section to use free local models instead of OpenAI
 */
/*
import { Ollama } from 'llamaindex';

Settings.llm = new Ollama({
  model: 'llama2', // or 'mistral', 'codellama', etc.
});

// Then use the same parseResumeWithLlamaIndex function above
// This will use the local Ollama model instead of OpenAI
*/
