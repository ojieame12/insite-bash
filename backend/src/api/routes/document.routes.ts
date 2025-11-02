import { Router } from 'express';
import multer from 'multer';
import { uploadDocument, getDocuments, getDocument, deleteDocument } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
});

router.post('/upload', authenticate, upload.single('document'), uploadDocument);
router.get('/', authenticate, getDocuments);
router.get('/:id', authenticate, getDocument);
router.delete('/:id', authenticate, deleteDocument);

export default router;
