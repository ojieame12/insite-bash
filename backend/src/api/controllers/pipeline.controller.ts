import { Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { PipelineRun } from '../../../../shared/types';

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
