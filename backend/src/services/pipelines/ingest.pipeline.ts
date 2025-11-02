import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import axios from 'axios';
import { IngestPipelineInput, IngestPipelineOutput } from '../../../../shared/types';
import { structureResumeContent } from '../llm/openai.service';

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

    // Extract text based on document type
    let extractedText = '';
    if (document.type === 'resume_pdf' || document.file_name?.endsWith('.pdf')) {
      const pdfData = await pdf(buffer);
      extractedText = pdfData.text;
    } else if (document.type === 'resume_docx' || document.file_name?.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      // Try PDF by default
      try {
        const pdfData = await pdf(buffer);
        extractedText = pdfData.text;
      } catch {
        throw new Error('Unsupported document format');
      }
    }

    // Save extracted text
    await supabase
      .from('documents')
      .update({ text_extracted: extractedText })
      .eq('id', documentId);

    logger.info('Text extracted, now structuring content', {
      userId,
      textLength: extractedText.length,
    });

    // Structure the content using LLM
    const structured = await structureResumeContent(extractedText);

    // Save work experiences
    let workExperiencesCreated = 0;
    if (structured.workExperiences && structured.workExperiences.length > 0) {
      for (const exp of structured.workExperiences) {
        const { error } = await supabase.from('work_experiences').insert({
          user_id: userId,
          company_name: exp.company,
          role_title: exp.title,
          start_date: exp.startDate,
          end_date: exp.endDate,
          is_current: exp.isCurrent || false,
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
          raw_text: achievement.text,
          metric_value: achievement.metricValue,
          metric_unit: achievement.metricUnit,
          scope: achievement.scope,
          provenance: 'user_provided',
          confidence: 1.0,
          requires_review: !achievement.metricValue, // Review if no metrics
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
          skill_name: skill.name,
          category: skill.category || 'general',
          proficiency: skill.proficiency || 'intermediate',
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
