import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { DocumentModel } from '../models/Document';
import { IngestionService } from '../services/ingestionService';

import { requireAuth } from '../middleware/authMiddleware';
import { uploadLimiter } from '../middleware/rateLimitMiddleware';

const router = express.Router();

// Configure multer for PDF uploads (max 10MB limit)
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

router.post('/upload', requireAuth, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
    }

    const userId = new mongoose.Types.ObjectId(req.user!.id);

    // 1. Create a Document record
    const document = new DocumentModel({
      userId,
      fileName: req.file.originalname,
      status: 'UPLOADED',
    });
    
    await document.save();

    // 2. Start asynchronous ingestion processing
    // We don't await this so we can return the ID immediately to the client
    IngestionService.processPdf(req.file.path, document._id as mongoose.Types.ObjectId, userId);

    return res.status(202).json({
      message: 'File uploaded and is being processed.',
      documentId: document._id,
      fileName: document.fileName,
      status: document.status
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during upload.' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const documents = await DocumentModel.find({ userId })
      .select('_id fileName status createdAt')
      .sort({ createdAt: -1 });
    
    return res.status(200).json(documents);
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ error: 'Internal server error fetching documents.' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const documentId = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID format.' });
    }

    const document = await DocumentModel.findOne({
      _id: new mongoose.Types.ObjectId(documentId),
      userId,
    }).select('_id fileName status createdAt');

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    return res.status(200).json(document);
  } catch (error: any) {
    console.error('Error fetching document status:', error);
    return res.status(500).json({ error: 'Internal server error fetching document.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const documentId = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID format.' });
    }

    const documentObjectId = new mongoose.Types.ObjectId(documentId);

    // 1. Find the document and verify ownership
    const document = await DocumentModel.findOne({
      _id: documentObjectId,
      userId,
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found or unauthorized.' });
    }

    // Import related models
    const { DocumentChunk } = await import('../models/DocumentChunk');
    const { Conversation } = await import('../models/Conversation');
    const { Message } = await import('../models/Message');

    // 2. Cascade delete DocumentChunks (cleans up Vector Search)
    await DocumentChunk.deleteMany({ documentId: documentObjectId, userId });

    // 3. Find conversations to delete their messages
    const conversations = await Conversation.find({ documentId: documentObjectId, userId });
    const conversationIds = conversations.map(c => c._id);

    // 4. Cascade delete Messages
    if (conversationIds.length > 0) {
      await Message.deleteMany({ conversationId: { $in: conversationIds } });
    }

    // 5. Cascade delete Conversations
    await Conversation.deleteMany({ documentId: documentObjectId, userId });

    // 6. Finally, delete the Document itself
    await DocumentModel.deleteOne({ _id: documentObjectId });

    return res.status(200).json({ message: 'Document and all associated data deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return res.status(500).json({ error: 'Internal server error deleting document.' });
  }
});

export default router;
