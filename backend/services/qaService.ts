import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { RetrievalService, RetrievalResult } from './retrievalService';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { DocumentModel } from '../models/Document';
import mongoose from 'mongoose';
import { z } from 'zod';

export interface QAResponse {
  conversationId: string;
  messageId: string;
  content: string;
  isAnswerable: boolean;
  citations: any[];
}

export class QAService {
  private retrievalService: RetrievalService;
  // Initialize the specific flash generation model as per .env
  private llm: ChatGoogleGenerativeAI;

  constructor() {
    this.retrievalService = new RetrievalService();
    const modelName = process.env.GEMINI_GENERATION_MODEL || 'gemini-3.6-flash';
    
    this.llm = new ChatGoogleGenerativeAI({
      model: modelName,
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY
    });
  }

  /**
   * Orchestrates the QA flow: Retrieval -> Answerability -> Generation -> Persistence
   */
  public async askQuestion(
    userId: string,
    documentId: string,
    question: string,
    conversationId?: string
  ): Promise<QAResponse> {
    
    // 1. Validate the Document belongs to the user
    const doc = await DocumentModel.findOne({
      _id: documentId,
      userId: userId
    });
    if (!doc) {
      throw new Error('Forbidden: Document not found or unauthorized');
    }

    // 2. Validate / Create Conversation
    let activeConversationId = conversationId;
    if (activeConversationId) {
      const conv = await Conversation.findOne({
        _id: activeConversationId,
        userId: userId,
        documentId: documentId
      });
      if (!conv) {
        throw new Error('Forbidden: Conversation not found or unauthorized');
      }
    } else {
      // Create new conversation
      const newConv = await Conversation.create({
        userId,
        documentId,
        title: question.substring(0, 50) + (question.length > 50 ? '...' : '')
      });
      activeConversationId = newConv._id.toString();
    }

    // 3. Save User Message
    await Message.create({
      conversationId: activeConversationId,
      role: 'user',
      content: question
    });

    // 4. Retrieve context
    const retrievedChunks = await this.retrievalService.search(question, userId, 5, documentId);
    
    // De-duplicate chunks based on chunkId to avoid redundant context
    const uniqueChunksMap = new Map<string, RetrievalResult>();
    for (const chunk of retrievedChunks) {
      if (!uniqueChunksMap.has(chunk.chunkId)) {
        uniqueChunksMap.set(chunk.chunkId, chunk);
      }
    }
    const uniqueChunks = Array.from(uniqueChunksMap.values());

    const combinedContext = uniqueChunks.map((c, i) => `[Source ${i + 1}]:\n${c.text}`).join('\n\n');

    let answerableResult = { isAnswerable: false, reason: 'No context found' };

    if (uniqueChunks.length > 0) {
      // 5. Answerability Check
      answerableResult = await this.checkAnswerability(question, combinedContext);
    }

    let finalContent = "I do not have enough information in the provided document to answer that.";
    const citations = uniqueChunks.map(c => ({
      documentId: new mongoose.Types.ObjectId(c.documentId),
      chunkId: new mongoose.Types.ObjectId(c.chunkId),
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      score: c.score
    }));

    if (answerableResult.isAnswerable) {
      // 6. Generate Grounded Answer
      finalContent = await this.generateAnswer(question, combinedContext);
    }

    // 7. Save AI Message
    const aiMessage = await Message.create({
      conversationId: activeConversationId,
      role: 'ai',
      content: finalContent,
      isAnswerable: answerableResult.isAnswerable,
      citations: answerableResult.isAnswerable ? citations : [] // Only attach citations if it answered the question
    });

    // 8. Return Response
    return {
      conversationId: activeConversationId!,
      messageId: aiMessage._id.toString(),
      content: finalContent,
      isAnswerable: answerableResult.isAnswerable,
      citations: answerableResult.isAnswerable ? citations.map(c => ({
        documentId: c.documentId.toString(),
        chunkId: c.chunkId.toString(),
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
        score: c.score
      })) : []
    };
  }

  private async checkAnswerability(question: string, context: string): Promise<{ isAnswerable: boolean, reason: string }> {
    const AnswerabilitySchema = z.object({
      isAnswerable: z.boolean().describe('Whether the question can be answered using ONLY the provided document context.'),
      reason: z.string().describe('The reasoning behind the determination.')
    });

    // We cast this safely for Langchain structured output
    const structuredLlm = this.llm.withStructuredOutput(AnswerabilitySchema);

    const prompt = `You are an expert AI assistant. Your task is to determine if the provided question can be answered strictly using ONLY the provided document context. Do not use outside knowledge. Return true if the context contains sufficient information, otherwise false.

Context:
${context}

Question: ${question}`;

    try {
      const response = await structuredLlm.invoke(prompt);
      return response;
    } catch (err) {
      console.error('Answerability check failed:', err);
      // Fallback safely
      return { isAnswerable: false, reason: 'Failed to process answerability' };
    }
  }

  private async generateAnswer(question: string, context: string): Promise<string> {
    const prompt = `You are a helpful, factual AI assistant. Answer the user's question using strictly the provided document context.
- Do NOT invent facts.
- Do NOT use outside knowledge.
- If the context does not fully answer the question, state what is missing.

Context:
${context}

Question: ${question}`;

    try {
      const response = await this.llm.invoke(prompt);
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    } catch (err) {
      console.error('Generation failed:', err);
      throw new Error('Failed to generate answer from Gemini API');
    }
  }
}
