import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { DocumentChunk } from '../models/DocumentChunk';
import { DocumentModel } from '../models/Document';

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB.');

    const chunk = await DocumentChunk.findOne({ embedding: { $exists: true, $ne: [] } });
    
    if (!chunk) {
      console.log('No chunks with embeddings found in DB.');
    } else {
      console.log(`Found chunk with _id: ${chunk._id}`);
      console.log(`Associated documentId: ${chunk.documentId}`);
      console.log(`Chunk index: ${chunk.chunkIndex}`);
      console.log(`Embedding dimensionality (array length): ${chunk.embedding?.length}`);
      
      if (chunk.embedding?.length === 3072) {
        console.log('✅ Dimensionality perfectly matches Atlas index configuration (3072).');
      } else {
        console.log(`❌ Dimensionality mismatch! Expected 3072, got ${chunk.embedding?.length}`);
      }
    }

    // Check status of latest document
    const doc = await DocumentModel.findOne().sort({ uploadedAt: -1 });
    if (doc) {
      console.log(`Latest document status: ${doc.status}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  }
}

verify();
