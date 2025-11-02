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
 * Parse and structure resume using LlamaParse with JSON mode
 * LlamaParse handles BOTH parsing AND structuring in one API call
 * No need for separate OpenAI calls!
 */
export async function parseResumeWithLlamaParse(
  filePath: string
): Promise<ParsedResume> {
  try {
    logger.info('Starting LlamaParse resume parsing with JSON mode', { filePath });

    // Initialize LlamaParse with JSON mode and parsing instructions
    const reader = new LlamaParseReader({
      apiKey: process.env.LLAMA_CLOUD_API_KEY!,
      resultType: 'json', // Request structured JSON output
      language: 'en',
      parsingInstructions: `Extract structured resume data in JSON format with these exact fields:

{
  "work_experiences": [
    {
      "company_name": "string",
      "role_title": "string", 
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM or null if current",
      "description": "brief summary",
      "is_current": boolean
    }
  ],
  "achievements": [
    {
      "raw_text": "original achievement text",
      "metric_value": number or null,
      "metric_unit": "users/revenue/% or null",
      "scope": "company/team/project name",
      "evidence_strength": "strong/medium/weak"
    }
  ],
  "skills": [
    {
      "skill_name": "string",
      "category": "technical/soft/language/tool",
      "proficiency_level": "expert/advanced/intermediate/beginner or null"
    }
  ]
}

Extract ALL work experiences, achievements (especially those with metrics), and skills.
For evidence_strength: "strong" if has metrics, "medium" if has context, "weak" otherwise.`,
    });

    // Parse the document - LlamaParse returns structured JSON directly!
    const documents = await reader.loadData(filePath);

    if (!documents || documents.length === 0) {
      throw new Error('No content extracted from document');
    }

    // Get the structured data
    const firstDoc = documents[0];
    let structured: any;

    // LlamaParse returns JSON in the text field when resultType is 'json'
    try {
      structured = typeof firstDoc.text === 'string' 
        ? JSON.parse(firstDoc.text)
        : firstDoc.text;
    } catch (parseError) {
      logger.error('Failed to parse LlamaParse JSON output', { parseError });
      // Fallback: try to extract JSON from the text
      const jsonMatch = firstDoc.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structured = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not extract structured data from LlamaParse output');
      }
    }

    // Extract unique company names
    const companies = [
      ...new Set(
        (structured.work_experiences || []).map((exp: WorkExperience) => exp.company_name)
      ),
    ];

    // Get raw text for storage (combine all documents)
    const rawText = documents.map((doc) => 
      typeof doc.text === 'string' ? doc.text : JSON.stringify(doc.text)
    ).join('\n\n');

    logger.info('LlamaParse extraction complete', {
      workExperiences: structured.work_experiences?.length || 0,
      achievements: structured.achievements?.length || 0,
      skills: structured.skills?.length || 0,
      companies: companies.length,
    });

    return {
      work_experiences: structured.work_experiences || [],
      achievements: structured.achievements || [],
      skills: structured.skills || [],
      companies,
      raw_text: rawText,
    };
  } catch (error: any) {
    logger.error('LlamaParse failed', { error: error.message, stack: error.stack });
    throw new Error(`Resume parsing failed: ${error.message}`);
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
