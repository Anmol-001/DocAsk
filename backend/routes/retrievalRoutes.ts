import { Router, Request, Response } from 'express';
import { RetrievalService } from '../services/retrievalService';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
const retrievalService = new RetrievalService();

router.post('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, documentId, topK } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const userId = req.user!.id;

    const limit = topK ? parseInt(topK, 10) : 5;
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Invalid topK parameter' });
    }

    const results = await retrievalService.search(query, userId, limit, documentId);

    return res.status(200).json({ results });
  } catch (error: any) {
    console.error('Retrieval route error:', error);
    
    // Send appropriate status codes based on error message
    if (error.message.includes('Query cannot be empty') || error.message.includes('Invalid topK')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Internal server error during retrieval' });
  }
});

export default router;
