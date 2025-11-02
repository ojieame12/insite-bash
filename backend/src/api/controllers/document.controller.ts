import { Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Document, UploadDocumentResponse } from '../../../../shared/types';
import { queueIngestPipeline } from '../../services/pipelines/ingest.pipeline';

export const uploadDocument = async (
  req: AuthRequest,
  res: Response<UploadDocumentResponse>,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const file = req.file;
    const userId = req.userId!;

    // Determine document type
    let docType: 'resume_pdf' | 'resume_docx' = 'resume_pdf';
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      docType = 'resume_docx';
    }

    // Upload to Supabase Storage
    const fileName = `${userId}/${Date.now()}_${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        type: docType,
        storage_url: publicUrl,
      })
      .select()
      .single();

    if (docError) throw docError;

    // Queue ingestion pipeline
    const pipelineRun = await queueIngestPipeline(userId, document.id);

    res.status(202).json({
      documentId: document.id,
      pipelineRunId: pipelineRun.id,
      status: 'queued',
      message: 'Document ingestion has started.',
    });
  } catch (error) {
    next(error);
  }
};

export const getDocuments = async (
  req: AuthRequest,
  res: Response<Document[]>,
  next: NextFunction
) => {
  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(documents.map(doc => ({
      id: doc.id,
      userId: doc.user_id,
      type: doc.type,
      storageUrl: doc.storage_url,
      textExtracted: doc.text_extracted,
      createdAt: doc.created_at,
    })));
  } catch (error) {
    next(error);
  }
};

export const getDocument = async (
  req: AuthRequest,
  res: Response<Document>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId!)
      .single();

    if (error || !document) {
      throw new AppError('Document not found', 404);
    }

    res.json({
      id: document.id,
      userId: document.user_id,
      type: document.type,
      storageUrl: document.storage_url,
      textExtracted: document.text_extracted,
      createdAt: document.created_at,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Delete from database
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId!);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
