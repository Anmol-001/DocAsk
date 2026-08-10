import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { DocumentChunk } from '../models/DocumentChunk';
import { EmbeddingService } from '../services/embeddingService';

async function backfill() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in the environment.');
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set. Cannot generate embeddings.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const chunksToBackfill = await DocumentChunk.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $size: 0 } },
        { embedding: null }
      ]
    });

    console.log(`Found ${chunksToBackfill.length} chunks without embeddings.`);

    if (chunksToBackfill.length === 0) {
      console.log('No backfill needed.');
      process.exit(0);
    }

    const embeddingService = new EmbeddingService();

    // Process in batches to avoid overwhelming the API
    const batchSize = 50;
    let successCount = 0;

    for (let i = 0; i < chunksToBackfill.length; i += batchSize) {
      const batch = chunksToBackfill.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunksToBackfill.length / batchSize)}...`);
      
      const texts = batch.map(c => c.text);
      const embeddings = await embeddingService.generateEmbeddings(texts);
      
      if (embeddings.length !== batch.length) {
        throw new Error('Mismatch in returned embeddings count.');
      }

      const bulkOps = batch.map((chunk, index) => ({
        updateOne: {
          filter: { _id: chunk._id },
          update: { $set: { embedding: embeddings[index] } }
        }
      }));

      await DocumentChunk.bulkWrite(bulkOps);
      successCount += batch.length;
      console.log(`Updated ${successCount}/${chunksToBackfill.length} chunks...`);
    }

    console.log(`Backfill complete. Successfully embedded ${successCount} chunks.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  }
}

backfill();
