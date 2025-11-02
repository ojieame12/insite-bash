import Queue from 'bull';
import { logger } from '../utils/logger';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const pipelineQueue = new Queue('pipeline', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export interface PipelineJobData {
  userId: string;
  documentId?: string;
  siteVersionId?: string;
  step: 'ingest' | 'logos' | 'achievements' | 'story' | 'skills' | 'images' | 'completeness';
  metadata?: Record<string, any>;
}

// Queue event listeners
pipelineQueue.on('completed', (job) => {
  logger.info(`Pipeline job completed`, {
    jobId: job.id,
    step: job.data.step,
    userId: job.data.userId,
  });
});

pipelineQueue.on('failed', (job, err) => {
  logger.error(`Pipeline job failed`, {
    jobId: job?.id,
    step: job?.data?.step,
    userId: job?.data?.userId,
    error: err.message,
  });
});

pipelineQueue.on('stalled', (job) => {
  logger.warn(`Pipeline job stalled`, {
    jobId: job.id,
    step: job.data.step,
    userId: job.data.userId,
  });
});

export async function queuePipelineStep(data: PipelineJobData): Promise<string> {
  const job = await pipelineQueue.add(data.step, data, {
    jobId: `${data.userId}-${data.step}-${Date.now()}`,
  });
  
  logger.info(`Queued pipeline step`, {
    jobId: job.id,
    step: data.step,
    userId: data.userId,
  });
  
  return job.id as string;
}

export async function queueFullPipeline(
  userId: string,
  documentId: string,
  siteVersionId?: string
): Promise<string[]> {
  const steps: PipelineJobData['step'][] = [
    'ingest',
    'logos',
    'achievements',
    'story',
    'skills',
    'images',
    'completeness', // Calculate completeness after all pipelines
  ];

  const jobIds: string[] = [];

  for (const step of steps) {
    const jobId = await queuePipelineStep({
      userId,
      documentId,
      siteVersionId,
      step,
    });
    jobIds.push(jobId);
  }

  return jobIds;
}
