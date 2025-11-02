import { LlamaParseReader } from '@llamaindex/cloud/reader';
import { logger } from '../../utils/logger';
import fs from 'fs';

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

interface ParsedResume {
  work_experiences: WorkExperience[];
  achievements: Achievement[];
  skills: Skill[];
  companies: string[];
  raw_text: string;
}

/**
 * Parse resume using LlamaParse from LlamaCloud
 * This is the official LlamaIndex cloud parsing service
 * Handles PDF, DOCX, and other document formats automatically
 */
export async function parseResumeWithLlamaParse(
  filePath: string
): Promise<ParsedResume> {
  try {
    logger.info('Starting LlamaParse resume parsing', { filePath });

    // Initialize LlamaParse reader with API key
    const reader = new LlamaParseReader({
      apiKey: process.env.LLAMA_CLOUD_API_KEY!,
      resultType: 'markdown', // Get structured markdown output
      language: 'en',
    });

    // Parse the document
    const documents = await reader.loadData(filePath);

    if (!documents || documents.length === 0) {
      throw new Error('No content extracted from document');
    }

    // Get the parsed text (LlamaParse returns structured markdown)
    const rawText = documents.map((doc) => doc.text).join('\n\n');

    logger.info('LlamaParse extraction complete', {
      textLength: rawText.length,
      documentCount: documents.length,
    });

    // Now use LLM to structure the parsed content
    const structured = await structureResumeFromText(rawText);

    return {
      ...structured,
      raw_text: rawText,
    };
  } catch (error: any) {
    logger.error('LlamaParse failed', { error: error.message });
    throw new Error(`Resume parsing failed: ${error.message}`);
  }
}

/**
 * Structure the parsed resume text into database-ready format
 * Uses OpenAI to extract structured data from LlamaParse output
 */
async function structureResumeFromText(text: string): Promise<Omit<ParsedResume, 'raw_text'>> {
  const { OpenAI } = await import('openai');
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const prompt = `Extract structured information from this resume in JSON format.

Resume:
${text}

Extract:
1. work_experiences: Array of jobs with company_name, role_title, start_date (YYYY-MM), end_date (YYYY-MM or null), description, is_current (boolean)
2. achievements: Array with raw_text, metric_value (number or null), metric_unit (string or null), scope (company/project), evidence_strength ("strong"/"medium"/"weak")
3. skills: Array with skill_name, category ("technical"/"soft"/"language"/"tool"), proficiency_level ("expert"/"advanced"/"intermediate"/"beginner" or null)

Return ONLY valid JSON with these exact field names.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting structured data from resumes. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    // Extract unique company names
    const companies = [
      ...new Set(
        (parsed.work_experiences || []).map((exp: WorkExperience) => exp.company_name)
      ),
    ];

    logger.info('Resume structuring complete', {
      workExperiences: parsed.work_experiences?.length || 0,
      achievements: parsed.achievements?.length || 0,
      skills: parsed.skills?.length || 0,
      companies: companies.length,
    });

    return {
      work_experiences: parsed.work_experiences || [],
      achievements: parsed.achievements || [],
      skills: parsed.skills || [],
      companies,
    };
  } catch (error: any) {
    logger.error('Resume structuring failed', { error: error.message });
    throw error;
  }
}

/**
 * Parse resume from buffer (for direct upload handling)
 */
export async function parseResumeFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParsedResume> {
  // Write buffer to temp file
  const tempPath = `/tmp/${Date.now()}-${filename}`;
  
  try {
    fs.writeFileSync(tempPath, buffer);
    const result = await parseResumeWithLlamaParse(tempPath);
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    return result;
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}
