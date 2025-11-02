import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getCareerGraph, getPublicCareerGraph } from '../controllers/career-graph.controller';

const router = Router();

/**
 * @route GET /api/v1/career-graph
 * @desc Get complete career graph for authenticated user
 * @access Private
 */
router.get('/', authenticateToken, getCareerGraph);

/**
 * @route GET /api/v1/career-graph/public/:userId
 * @desc Get public career graph for published portfolio
 * @access Public
 */
router.get('/public/:userId', getPublicCareerGraph);

export default router;
