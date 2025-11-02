import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
// Removed pdf-parse and mammoth - now using LlamaParse
import axios from 'axios';
import { IngestPipelineInput, IngestPipelineOutput } from '../../../../shared/types';
import { parseResumeFromBuffer } from '../llm/llamaparse.service';

/**
 * Run ingestion pipeline
 * Extracts text from resume and structures it into work experiences, achievements, and skills
 */
export async function runIngestPipeline(userId: string, documentId: string): Promise<void> {
  try {
    logger.info('Starting ingestion pipeline', { userId, documentId });

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download document
    const response = await axios.get(document.storage_url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

      const buffer = Buffer.from(response.data);

    // Parse resume with LlamaParse (handles PDF, DOCX, etc. automatically)
    logger.info('Parsing resume with LlamaParse', { userId, documentId });
    const structured = await parseResumeFromBuffer(buffer, document.file_name || 'resume.pdf');

    // Update document with extracted text
    await supabase
      .from('documents')
      .update({ extracted_text: structured.raw_text })
      .eq('id', documentId);

    logger.info('LlamaParse completed', {
      userId,
      textLength: structured.raw_text.length,
    });

    // Save work experiences
    let workExperiencesCreated = 0;
    if (structured.work_experiences && structured.work_experiences.length > 0) {
      for (const exp of structured.work_experiences) {
        const { error } = await supabase.from('work_experiences').insert({
          user_id: userId,
          company_name: exp.company_name,
          role_title: exp.role_title,
          start_date: exp.start_date,
          end_date: exp.end_date,
          is_current: exp.is_current || false,
          description: exp.description,
        });

        if (!error) workExperiencesCreated++;
      }
    }

    // Save achievements
    let achievementsCreated = 0;
    if (structured.achievements && structured.achievements.length > 0) {
      for (const achievement of structured.achievements) {
        const { error } = await supabase.from('achievements').insert({
          user_id: userId,
          raw_text: achievement.raw_text,
          metric_value: achievement.metric_value,
          metric_unit: achievement.metric_unit,
          scope: achievement.scope,
          evidence_strength: achievement.evidence_strength,
          provenance: 'user_provided',
          confidence: 1.0,
          requires_review: !achievement.metric_value, // Review if no metrics
        });

        if (!error) achievementsCreated++;
      }
    }

    // Save skills
    let skillsCreated = 0;
    if (structured.skills && structured.skills.length > 0) {
      for (const skill of structured.skills) {
        const { error } = await supabase.from('skills').insert({
          user_id: userId,
          skill_name: skill.skill_name,
          category: skill.category || 'general',
          proficiency_level: skill.proficiency_level || 'intermediate',
        });

        if (!error) skillsCreated++;
      }
    }

    // Extract companies for logo pipeline
    const companies = structured.workExperiences?.map((exp) => exp.company) || [];
    if (companies.length > 0) {
      for (const companyName of companies) {
        // Check if company already exists
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .eq('name', companyName)
          .single();

        if (!existing) {
          await supabase.from('companies').insert({
            user_id: userId,
            name: companyName,
          });
        }
      }
    }

    logger.info('Ingestion pipeline completed', {
      userId,
      documentId,
      workExperiencesCreated,
      achievementsCreated,
      skillsCreated,
      companiesExtracted: companies.length,
    });
  } catch (error) {
    logger.error('Ingestion pipeline failed', { userId, documentId, error });
    throw error;
  }
}
