import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import axios from 'axios';
import { IngestPipelineInput, IngestPipelineOutput } from '../../../../shared/types';

/**
 * Queue an ingestion pipeline run
 */
export async function queueIngestPipeline(userId: string, documentId: string) {
  const { data: pipelineRun, error } = await supabase
    .from('pipeline_runs')
    .insert({
      user_id: userId,
      kind: 'ingest',
      status: 'queued',
      input: { documentId },
    })
    .select()
    .single();

  if (error) throw error;

  // TODO: Add to Bull queue for async processing
  // For now, process immediately
  processIngestPipeline(pipelineRun.id, userId, documentId);

  return pipelineRun;
}

/**
 * Process the ingestion pipeline
 */
async function processIngestPipeline(
  pipelineRunId: string,
  userId: string,
  documentId: string
) {
  try {
    // Update status to running
    await supabase
      .from('pipeline_runs')
      .update({ status: 'running' })
      .eq('id', pipelineRunId);

    // Get document
    const { data: document } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (!document) throw new Error('Document not found');

    // Download document
    const response = await axios.get(document.storage_url, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);

    // Extract text based on document type
    let extractedText = '';
    if (document.type === 'resume_pdf') {
      const pdfData = await pdf(buffer);
      extractedText = pdfData.text;
    } else if (document.type === 'resume_docx') {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    // Save extracted text
    await supabase
      .from('documents')
      .update({ text_extracted: extractedText })
      .eq('id', documentId);

    // TODO: Parse extracted text with LlamaIndex/LLM
    // For now, create placeholder data
    const output: IngestPipelineOutput = {
      extractedText,
      workExperiencesCreated: 0,
      achievementsCreated: 0,
      skillsCreated: 0,
    };

    // Update pipeline run as succeeded
    await supabase
      .from('pipeline_runs')
      .update({
        status: 'succeeded',
        output,
      })
      .eq('id', pipelineRunId);

    logger.info(`Ingestion pipeline ${pipelineRunId} completed successfully`);
  } catch (error) {
    logger.error(`Ingestion pipeline ${pipelineRunId} failed:`, error);

    await supabase
      .from('pipeline_runs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', pipelineRunId);
  }
}
