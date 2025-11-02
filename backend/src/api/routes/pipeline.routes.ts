import { Router } from 'express';
import { getPipelineRun, getPipelineRuns, runPipeline, getPipelineStatus } from '../controllers/pipeline.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/run', authenticate, runPipeline);
router.get('/status', authenticate, getPipelineStatus);
router.get('/:id', authenticate, getPipelineRun);
router.get('/', authenticate, getPipelineRuns);

export default router;
