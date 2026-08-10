import { RetrievalService } from '../services/retrievalService';
import { DocumentModel } from '../models/Document';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('MongoDB Connected.');

  const retrievalService = new RetrievalService();

  // Get a valid document and user from the DB
  const doc = await DocumentModel.findOne({ status: 'READY' });
  if (!doc) {
    console.error('No READY document found in DB. Cannot test retrieval.');
    process.exit(1);
  }

  const userId = doc.userId.toString();
  const documentId = doc._id.toString();

  console.log(`\nUsing User ID: ${userId}`);
  console.log(`Using Document ID: ${documentId}\n`);

  try {
    // Test 1: Relevant query, topK = 3
    console.log('--- Test 1: Relevant query (topK: 3) ---');
    const q1 = "What is this document about?"; // General query depending on what dummy PDF has
    const res1 = await retrievalService.search(q1, userId, 3);
    console.log(`Query: "${q1}"`);
    console.log(`Returned chunks: ${res1.length}`);
    res1.forEach((r, i) => {
      console.log(`  [${i+1}] Score: ${r.score.toFixed(4)} | Page: ${r.pageStart}-${r.pageEnd} | ChunkIndex: ${r.chunkIndex} | Snippet: ${r.text.substring(0, 100).replace(/\n/g, ' ')}...`);
    });

    // Test 2: Specific question
    console.log('\n--- Test 2: Another relevant query (documentId filter) ---');
    const q2 = "Can you summarize the main points?"; 
    const res2 = await retrievalService.search(q2, userId, 2, documentId);
    console.log(`Query: "${q2}"`);
    console.log(`Returned chunks: ${res2.length}`);
    res2.forEach((r, i) => {
      console.log(`  [${i+1}] Score: ${r.score.toFixed(4)} | Page: ${r.pageStart}-${r.pageEnd} | Snippet: ${r.text.substring(0, 100).replace(/\n/g, ' ')}...`);
    });

    // Test 3: Unauthorized user (isolation test)
    console.log('\n--- Test 3: User Isolation Test ---');
    const fakeUserId = new mongoose.Types.ObjectId().toString();
    console.log(`Testing with unauthorized User ID: ${fakeUserId}`);
    const res3 = await retrievalService.search(q1, fakeUserId, 5);
    console.log(`Returned chunks for unauthorized user: ${res3.length} (Expected: 0)`);

    // Test 4: Irrelevant query (threshold test)
    console.log('\n--- Test 4: Irrelevant query (Threshold test) ---');
    const q4 = "How to bake a chocolate cake recipe ingredients";
    const res4 = await retrievalService.search(q4, userId, 5);
    console.log(`Query: "${q4}"`);
    console.log(`Returned chunks: ${res4.length} (Expected: 0 due to low relevance)`);

    // Test 5: Empty query (Validation test)
    console.log('\n--- Test 5: Empty Query Validation ---');
    try {
      await retrievalService.search('', userId, 5);
      console.log('Failed: Empty query should have thrown an error.');
    } catch (e: any) {
      console.log(`Success: Caught expected error -> ${e.message}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }

  process.exit(0);
}

runTests().catch(console.error);
