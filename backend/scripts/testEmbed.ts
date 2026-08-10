import { EmbeddingService } from '../services/embeddingService';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('MongoDB Connected.');

  console.log('Initializing EmbeddingService...');
  const service = new EmbeddingService();
  console.log('Generating embedding...');
  const vectors = await service.generateEmbeddings(['This is a test document for Gemini embeddings.']);
  
  if (vectors.length > 0 && vectors[0].length === 3072) {
    console.log('SUCCESS: Generated embedding with exactly 3072 dimensions.');
  } else {
    console.error('FAILED: Invalid embedding dimension or missing vectors.');
  }

  process.exit(0);
}

run().catch(console.error);
