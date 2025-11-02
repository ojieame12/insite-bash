#!/usr/bin/env node
/**
 * Pipeline Worker Process
 * Runs Bull queue workers to process pipeline jobs
 */
import dotenv from 'dotenv';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Import worker (this starts the queue processors)
import './workers/pipeline.worker';

logger.info('Pipeline worker process started');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
