import { Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { PipelineRun } from '../../../../shared/types';
import { queueFullPipeline, queuePipelineStep } from '../../queues/pipeline.queue';
import { logger } from '../../utils/logger';

export const getPipelineRun = async (
  req: AuthRequest,
  res: Response<PipelineRun>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const { data: pipelineRun, error } = await supabase
      .from('pipeline_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId!)
      .single();

    if (error || !pipelineRun) {
      throw new AppError('Pipeline run not found', 404);
    }

    res.json({
      id: pipelineRun.id,
      userId: pipelineRun.user_id,
      kind: pipelineRun.kind,
      status: pipelineRun.status,
      input: pipelineRun.input,
      output: pipelineRun.output,
      error: pipelineRun.error,
      createdAt: pipelineRun.created_at,
      updatedAt: pipelineRun.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

export const getPipelineRuns = async (
  req: AuthRequest,
  res: Response<PipelineRun[]>,
  next: NextFunction
) => {
  try {
    const { kind, status } = req.query;

    let query = supabase
      .from('pipeline_runs')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });

    if (kind) {
      query = query.eq('kind', kind);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: pipelineRuns, error } = await query;

    if (error) throw error;

    res.json(pipelineRuns.map(run => ({
      id: run.id,
      userId: run.user_id,
      kind: run.kind,
      status: run.status,
      input: run.input,
      output: run.output,
      error: run.error,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    })));
  } catch (error) {
    next(error);
  }
};

/**
 * Start pipeline execution
 * POST /pipelines/run
 */
export const runPipeline = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId!;
    const { steps, documentId, siteVersionId } = req.body;

    logger.info('Starting pipeline execution', {
      userId,
      steps: steps || 'all',
      documentId,
    });

    let jobIds: string[];

    if (steps && Array.isArray(steps)) {
      // Queue specific steps
      jobIds = [];
      for (const step of steps) {
        const jobId = await queuePipelineStep({
          userId,
          documentId,
          siteVersionId,
          step,
        });
        jobIds.push(jobId);
      }
    } else {
      // Queue full pipeline\n      if (!documentId) {
        throw new AppError('documentId is required for full pipeline', 400);
      }
      jobIds = await queueFullPipeline(userId, documentId, siteVersionId);
    }

    res.status(202).json({
      message: 'Pipeline queued successfully',
      jobIds,
      status: 'queued',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pipeline status for user
 * Returns current status of all pipeline steps
 */
export const getPipelineStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId!;

    // Get latest status for each pipeline step
    const { data, error } = await supabase
      .from('pipeline_runs')
      .select('pipeline_name, status, error_message, started_at, completed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by pipeline_name and get latest
    const statusMap = new Map();
    data?.forEach((run) => {
      if (!statusMap.has(run.pipeline_name)) {
        statusMap.set(run.pipeline_name, run);
      }
    });

    const statuses = Array.from(statusMap.values());

    res.json({
      userId,
      pipelines: statuses,
      overall: calculateOverallStatus(statuses),
    });
  } catch (error) {
    next(error);
  }
};

function calculateOverallStatus(pipelines: any[]): string {
  if (pipelines.length === 0) return 'not_started';
  
  const hasRunning = pipelines.some((p) => p.status === 'running');
  const hasFailed = pipelines.some((p) => p.status === 'failed');
  const allSucceeded = pipelines.every((p) => p.status === 'succeeded');

  if (hasRunning) return 'running';
  if (hasFailed) return 'failed';
  if (allSucceeded) return 'completed';
  
  return 'pending';
}
