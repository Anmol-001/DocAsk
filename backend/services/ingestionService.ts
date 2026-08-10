import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import mongoose from 'mongoose';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { EmbeddingService } from './embeddingService';

export class IngestionService {
  private static embeddingService = new EmbeddingService();
  /**
   * Processes a PDF file: extracts text, cleans, chunks, and persists to DB.
   */
  public static async processPdf(
    filePath: string,
    documentId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      // 1. Update status to EXTRACTING
      await DocumentModel.findByIdAndUpdate(documentId, { status: 'EXTRACTING' });

      // 2. Extract text using pdf-parse directly and preserve pages
      const dataBuffer = fs.readFileSync(filePath);
      const pages: { content: string; pageNumber: number }[] = [];
      let pageCounter = 1;
      
      const renderPage = async function(pageData: any) {
        const textContent = await pageData.getTextContent({ normalizeWhitespace: true });
        let lastY = '';
        let text = '';
        for (let item of textContent.items) {
            if (lastY !== item.transform[5] && lastY !== '') text += '\n';
            text += item.str;
            lastY = item.transform[5];
        }
        pages.push({ content: text, pageNumber: pageCounter++ });
        return text;
      };

      await pdfParse(dataBuffer, { pagerender: renderPage });

      // 3. Clean/Normalize text
      const cleanedDocs = pages.map((doc) => {
        return {
          ...doc,
          content: doc.content.replace(/\0/g, '').replace(/\r\n/g, '\n').trim(),
        };
      });

      // 4. Update status to CHUNKING
      await DocumentModel.findByIdAndUpdate(documentId, { status: 'CHUNKING' });

      // 5. Chunking & 6. Persist chunks in MongoDB
      const chunkSize = 1000;
      const chunkOverlap = 200;
      
      const chunksToInsert: any[] = [];
      let globalChunkIndex = 0;

      for (const doc of cleanedDocs) {
        if (!doc.content) continue;
        let i = 0;
        const text = doc.content;
        
        while (i < text.length) {
            let end = i + chunkSize;
            if (end >= text.length) {
                const chunkText = text.slice(i).trim();
                if (chunkText) {
                    chunksToInsert.push({
                        documentId,
                        userId,
                        chunkIndex: globalChunkIndex++,
                        text: chunkText,
                        pageStart: doc.pageNumber,
                        pageEnd: doc.pageNumber,
                        charCount: chunkText.length,
                    });
                }
                break;
            }
            // Try to break at a newline
            let breakPoint = text.lastIndexOf('\n', end);
            if (breakPoint <= i) {
                breakPoint = text.lastIndexOf(' ', end);
            }
            if (breakPoint <= i) {
                breakPoint = end; // force break
            }
            
            const chunkText = text.slice(i, breakPoint).trim();
            if (chunkText) {
                chunksToInsert.push({
                    documentId,
                    userId,
                    chunkIndex: globalChunkIndex++,
                    text: chunkText,
                    pageStart: doc.pageNumber,
                    pageEnd: doc.pageNumber,
                    charCount: chunkText.length,
                });
            }
            
            i = Math.max(i + 1, breakPoint - chunkOverlap);
        }
      }

      if (chunksToInsert.length > 0) {
        const insertedChunks = await DocumentChunk.insertMany(chunksToInsert);
        
        // 7. Update status to EMBEDDING
        await DocumentModel.findByIdAndUpdate(documentId, { status: 'EMBEDDING' });

        try {
          // Extract text arrays
          const textsToEmbed = insertedChunks.map(chunk => chunk.text);
          
          // Generate embeddings via EmbeddingService in batches
          const batchSize = 100;
          let allEmbeddings: number[][] = [];
          
          for (let i = 0; i < textsToEmbed.length; i += batchSize) {
             const batch = textsToEmbed.slice(i, i + batchSize);
             const batchEmbeddings = await this.embeddingService.generateEmbeddings(batch);
             allEmbeddings = allEmbeddings.concat(batchEmbeddings);
          }
          
          if (allEmbeddings.length === insertedChunks.length) {
            // Bulk update chunks with their embeddings
            const bulkOps = insertedChunks.map((chunk, index) => ({
              updateOne: {
                filter: { _id: chunk._id },
                update: { $set: { embedding: allEmbeddings[index] } }
              }
            }));
            await DocumentChunk.bulkWrite(bulkOps);
          } else {
             // If array sizes mismatch or API returned empty array (e.g. missing keys)
             if (allEmbeddings.length > 0) {
                 throw new Error("Mismatch between chunks and generated embeddings count.");
             }
          }
        } catch (embedError: any) {
          console.error("Embedding generation failed:", embedError);
          // 9. Ensure partial embedding failures are handled safely. Do not mark a document READY if required chunks failed to receive embeddings.
          throw embedError; // Re-throw to trigger PROCESSING_FAILED
        }
      }

      // 9. Update status to READY
      await DocumentModel.findByIdAndUpdate(documentId, { status: 'READY' });
    } catch (error: any) {
      console.error('!!! REAL ERROR:', error.stack || error);
      await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'PROCESSING_FAILED',
        errorMessage: error.message || 'Unknown processing error',
      });
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}
