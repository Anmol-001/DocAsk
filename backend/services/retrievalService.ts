import { DocumentChunk } from '../models/DocumentChunk';
import { EmbeddingService } from './embeddingService';
import mongoose from 'mongoose';

export interface RetrievalResult {
  chunkId: string;
  documentId: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  chunkIndex: number;
  score: number;
}

export class RetrievalService {
  private embeddingService: EmbeddingService;
  // Make minScore configurable, default to 0.6
  private minScore: number = process.env.RETRIEVAL_MIN_SCORE ? parseFloat(process.env.RETRIEVAL_MIN_SCORE) : 0.6;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Perform semantic search using MongoDB Atlas Vector Search
   */
  public async search(
    query: string,
    userId: string,
    topK: number = 5,
    documentId?: string
  ): Promise<RetrievalResult[]> {
    if (!query || query.trim() === '') {
      throw new Error('Query cannot be empty');
    }
    
    if (topK < 1 || topK > 100) {
      throw new Error('Invalid topK parameter. Must be between 1 and 100.');
    }

    // 1. Generate embedding for the query
    let queryEmbedding: number[];
    try {
      // The generateEmbeddings method expects an array of texts
      const embeddings = await this.embeddingService.generateEmbeddings([query]);
      if (!embeddings || embeddings.length === 0) {
        throw new Error('Failed to generate embedding: empty response');
      }
      queryEmbedding = embeddings[0];
    } catch (error) {
      console.error('Embedding API failure:', error);
      throw new Error('Failed to generate query embedding');
    }

    // 2. Build the filter for user/document isolation
    const filter: any = {
      userId: new mongoose.Types.ObjectId(userId)
    };
    
    if (documentId) {
      filter.documentId = new mongoose.Types.ObjectId(documentId);
    }

    // 3. Execute MongoDB Atlas Vector Search
    let results: any[];
    try {
      results = await DocumentChunk.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: Math.max(topK * 10, 100), // Standard practice: 10x limit
            limit: topK,
            filter: filter
          }
        },
        {
          // Project only the needed fields and the vector search score
          $project: {
            _id: 1,
            documentId: 1,
            text: 1,
            pageStart: 1,
            pageEnd: 1,
            chunkIndex: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);
    } catch (error) {
      console.error('MongoDB Vector Search failure:', error);
      throw new Error('Failed to execute semantic search');
    }

    // 4. Map results and enforce minimum relevance threshold
    const structuredResults: RetrievalResult[] = [];
    
    for (const doc of results) {
      if (doc.score >= this.minScore) {
        structuredResults.push({
          chunkId: doc._id.toString(),
          documentId: doc.documentId.toString(),
          text: doc.text,
          pageStart: doc.pageStart,
          pageEnd: doc.pageEnd,
          chunkIndex: doc.chunkIndex,
          score: doc.score
        });
      }
    }

    return structuredResults;
  }
}
