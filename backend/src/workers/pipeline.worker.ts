import { Job } from 'bull';
import { pipelineQueue, PipelineJobData } from '../queues/pipeline.queue';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { runIngestPipeline } from '../services/pipelines/ingest.pipeline';
import { runLogoPipeline } from '../services/pipelines/logo.pipeline';
import { generateProfessionalImages } from '../services/pipelines/image.pipeline';
import { runAchievementsPipeline } from '../services/pipelines/achievements.pipeline';
import { calculateAllCompleteness } from '../services/completeness.service';
import { runStoryPipeline } from '../services/pipelines/story.pipeline';
import { runSkillsPipeline } from '../services/pipelines/skills.pipeline';

async function updatePipelineStatus(
  userId: string,
  step: string,
  status: 'pending' | 'running' | 'succeeded' | 'failed',
  error?: string
) {
  try {
    // Check if pipeline_run exists
    const { data: existing } = await supabase
      .from('pipeline_runs')
      .select('id')
      .eq('user_id', userId)
      .eq('pipeline_name', step)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from('pipeline_runs')
        .update({
          status,
          error_message: error || null,
          completed_at: status === 'succeeded' || status === 'failed' ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('pipeline_runs').insert({
        user_id: userId,
        pipeline_name: step,
        status,
        error_message: error || null,
        started_at: new Date().toISOString(),
        completed_at: status === 'succeeded' || status === 'failed' ? new Date().toISOString() : null,
      });
    }
  } catch (err) {
    logger.error('Failed to update pipeline status', { userId, step, status, error: err });
  }
}

// Process ingest pipeline
pipelineQueue.process('ingest', async (job: Job<PipelineJobData>) => {
  const { userId, documentId } = job.data;
  
  logger.info(`Processing ingest pipeline`, { userId, documentId });
  await updatePipelineStatus(userId, 'ingest', 'running');

  try {
    if (!documentId) {
      throw new Error('Document ID is required for ingest pipeline');
    }

    await runIngestPipeline(userId, documentId);
    await updatePipelineStatus(userId, 'ingest', 'succeeded');
    
    logger.info(`Ingest pipeline completed`, { userId, documentId });
  } catch (error: any) {
    await updatePipelineStatus(userId, 'ingest', 'failed', error.message);
    throw error;
  }
});

// Process logos pipeline
pipelineQueue.process('logos', async (job: Job<PipelineJobData>) => {
  const { userId } = job.data;
  
  logger.info(`Processing logos pipeline`, { userId });
  await updatePipelineStatus(userId, 'logos', 'running');

  try {
    await runLogoPipeline(userId);
    await updatePipelineStatus(userId, 'logos', 'succeeded');
    
    logger.info(`Logos pipeline completed`, { userId });
  } catch (error: any) {
    await updatePipelineStatus(userId, 'logos', 'failed', error.message);
    throw error;
  }
});

// Process images pipeline
pipelineQueue.process('images', async (job: Job<PipelineJobData>) => {
  const { userId, siteVersionId } = job.data;
  
  logger.info(`Processing images pipeline`, { userId, siteVersionId });
  await updatePipelineStatus(userId, 'images', 'running');

  try {
    // Get user's uploaded portrait
    const { data: portrait } = await supabase
      .from('assets')
      .select('storage_url')
      .eq('user_id', userId)
      .eq('kind', 'portrait_src')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!portrait) {
      throw new Error('No portrait photo found for user');
    }

    await generateProfessionalImages(userId, portrait.storage_url, siteVersionId);
    await updatePipelineStatus(userId, 'images', 'succeeded');
    
    logger.info(`Images pipeline completed`, { userId });
  } catch (error: any) {
    await updatePipelineStatus(userId, 'images', 'failed', error.message);
    throw error;
  }
});

// Process achievements pipeline
pipelineQueue.process('achievements', async (job: Job<PipelineJobData>) => {
  const { userId } = job.data;
  
  logger.info(`Processing achievements pipeline`, { userId });
  await updatePipelineStatus(userId, 'achievements', 'running');

  try {
    await runAchievementsPipeline(userId);
    await updatePipelineStatus(userId, 'achievements', 'succeeded');
    
    logger.info(`Achievements pipeline completed`, { userId });
  } catch (error: any) {
    await updatePipelineStatus(userId, 'achievements', 'failed', error.message);
    throw error;
  }
});

// Process story pipeline
pipelineQueue.process('story', async (job: Job<PipelineJobData>) => {
  const { userId } = job.data;
  
  logger.info(`Processing story pipeline`, { userId });
  await updatePipelineStatus(userId, 'story', 'running');

  try {
    await runStoryPipeline(userId);
    await updatePipelineStatus(userId, 'story', 'succeeded');
    
    logger.info(`Story pipeline completed`, { userId });
  } catch (error: any) {
    await updatePipelineStatus(userId, 'story', 'failed', error.message);
    throw error;
  }
});

// Process skills pipeline
pipelineQueue.process('skills', async (job: Job<PipelineJobData>) => {
  const { userId } = job.data;
  
  logger.info(`Processing skills pipeline`, { userId });
  await updatePipelineStatus(userId, 'skills', 'running');

  try {
    await runSkillsPipeline(userId);
    await updatePipelineStatus(userId, 'skills', 'succeeded');
    
    logger.info(`Skills pipeline completed`, { userId });
  } catch (error: any) {
    await updatePipelineStatus(userId, 'skills', 'failed', error.message);
    throw error;
  }
});

// Process completeness calculation after all pipelines
pipelineQueue.process('completeness', async (job: Job<PipelineJobData>) => {
  const { userId } = job.data;
  
  logger.info(`Calculating completeness scores`, { userId });

  try {
    await calculateAllCompleteness(userId);
    logger.info(`Completeness calculation completed`, { userId });
  } catch (error: any) {
    logger.error(`Completeness calculation failed`, { userId, error: error.message });
    throw error;
  }
});

logger.info('Pipeline worker started and listening for jobs');
