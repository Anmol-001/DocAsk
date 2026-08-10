import { Router, Request, Response } from 'express';
import { QAService } from '../services/qaService';
import { requireAuth } from '../middleware/authMiddleware';
import { qaLimiter } from '../middleware/rateLimitMiddleware';
import mongoose from 'mongoose';

const router = Router();
const qaService = new QAService();

router.post('/ask', requireAuth, qaLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId, question, conversationId } = req.body;
    
    // The userId is guaranteed by the auth middleware
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validation
    if (!question || typeof question !== 'string' || question.trim() === '') {
      res.status(400).json({ error: 'Question cannot be empty' });
      return;
    }

    if (question.length > 2000) {
      res.status(400).json({ error: 'Question length exceeds the 2000 character limit' });
      return;
    }

    if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
      res.status(400).json({ error: 'Invalid documentId' });
      return;
    }

    if (conversationId && !mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ error: 'Invalid conversationId' });
      return;
    }

    // Execute QA Flow
    const response = await qaService.askQuestion(userId, documentId, question, conversationId);
    
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Q&A endpoint error:', error);
    
    // Safely handle specific errors without exposing stack traces
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.includes('Forbidden')) {
      res.status(403).json({ error: message });
    } else if (message.includes('Failed to generate answer')) {
      res.status(502).json({ error: 'AI generation failed temporarily. Please try again.' });
    } else {
      res.status(500).json({ error: 'Internal server error processing Q&A request.' });
    }
  }
});

router.get('/conversations/:documentId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const documentId = req.params.documentId as string;
    
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      res.status(400).json({ error: 'Invalid documentId' });
      return;
    }
    
    // Import Conversation model (assuming it's exported from models)
    const { Conversation } = await import('../models/Conversation');
    
    const conversations = await Conversation.find({ 
      userId, 
      documentId 
    }).sort({ createdAt: -1 });
    
    res.status(200).json(conversations);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal server error fetching conversations.' });
  }
});

router.get('/conversations/:conversationId/messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.conversationId as string;
    
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ error: 'Invalid conversationId' });
      return;
    }
    
    const { Conversation } = await import('../models/Conversation');
    const { Message } = await import('../models/Message');
    
    // Verify ownership
    const conv = await Conversation.findOne({ _id: conversationId, userId });
    if (!conv) {
      res.status(403).json({ error: 'Forbidden: Conversation not found or unauthorized' });
      return;
    }
    
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    
    res.status(200).json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error fetching messages.' });
  }
});

export default router;
