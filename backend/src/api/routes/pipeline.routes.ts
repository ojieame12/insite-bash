import { Router } from 'express';
import { getPipelineRun, getPipelineRuns } from '../controllers/pipeline.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/:id', authenticate, getPipelineRun);
router.get('/', authenticate, getPipelineRuns);

export default router;
