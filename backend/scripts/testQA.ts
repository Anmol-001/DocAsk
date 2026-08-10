import { QAService } from '../services/qaService';
import { DocumentModel } from '../models/Document';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Ensure the db connection is open
import { connectDB } from '../config/db';

const TEST_USER_ID = '5f8d0d55b54764421b7156d0'; // Matches authMiddleware test user
const UNAUTHORIZED_USER_ID = '6a79e46e1dfb8a70a69e6e41'; 

async function runTests() {
  await connectDB();
  const qaService = new QAService();

  // Find a valid document for the test user
  const doc = await DocumentModel.findOne({ userId: TEST_USER_ID, status: 'READY' });
  if (!doc) {
    console.error('No READY document found in DB for the test user.');
    process.exit(1);
  }
  const documentId = doc._id.toString();
  console.log(`Using Document ID: ${documentId}`);

  let activeConversationId: string;

  try {
    // --- Test A & D: Answerable question → grounded answer + citations ---
    console.log('\n--- Test A & D: Answerable Question (Grounded + Citations) ---');
    const resA = await qaService.askQuestion(TEST_USER_ID, documentId, 'What is this document about?');
    console.log('Result:', { isAnswerable: resA.isAnswerable, content: resA.content });
    console.log('Citations mapped:', resA.citations.length);
    activeConversationId = resA.conversationId;
    if (!resA.isAnswerable || resA.citations.length === 0) {
      console.warn('⚠️ Warning: Expected answerable with citations for a generic question.');
    }

    // --- Test K: Conversation continuation works ---
    console.log('\n--- Test K: Conversation Continuation ---');
    const resK = await qaService.askQuestion(TEST_USER_ID, documentId, 'Can you elaborate?', activeConversationId);
    if (resK.conversationId !== activeConversationId) {
      console.error('❌ Conversation continuation failed! ID mismatch.');
    } else {
      console.log('Success: Conversation continued on ID:', activeConversationId);
    }
    
    // Check DB for Messages
    const messageCount = await Message.countDocuments({ conversationId: activeConversationId });
    console.log(`Total messages in conversation ${activeConversationId}: ${messageCount} (Expected: 4)`);

    // --- Test B: Unanswerable question → controlled fallback ---
    console.log('\n--- Test B: Unanswerable Question (Random text) ---');
    const resB = await qaService.askQuestion(TEST_USER_ID, documentId, 'asdfghjklqwerty');
    console.log('Result:', { isAnswerable: resB.isAnswerable, content: resB.content });
    if (resB.isAnswerable) {
      console.error('❌ Expected isAnswerable: false');
    }

    // --- Test C: Question requiring outside knowledge ---
    console.log('\n--- Test C: Question Requiring Outside Knowledge ---');
    const resC = await qaService.askQuestion(TEST_USER_ID, documentId, 'What is the capital of France?');
    console.log('Result:', { isAnswerable: resC.isAnswerable, content: resC.content });
    if (resC.isAnswerable) {
      console.error('❌ Expected isAnswerable: false (assuming document is not about France)');
    }

    // --- Test F: Another user's document cannot be queried ---
    console.log('\n--- Test F: Unauthorized Document Access ---');
    try {
      await qaService.askQuestion(UNAUTHORIZED_USER_ID, documentId, 'Hello?');
      console.error('❌ Expected error for unauthorized document access.');
    } catch (e: any) {
      console.log('Success: Caught expected error ->', e.message);
    }

    // --- Test G: Another user's conversation cannot be accessed ---
    console.log('\n--- Test G: Unauthorized Conversation Access ---');
    try {
      await qaService.askQuestion(UNAUTHORIZED_USER_ID, documentId, 'Hello?', activeConversationId);
      console.error('❌ Expected error for unauthorized conversation access.');
    } catch (e: any) {
      console.log('Success: Caught expected error ->', e.message);
    }

  } catch (error) {
    console.error('Test Execution Failed:', error);
  } finally {
    mongoose.disconnect();
    console.log('\nTests Finished.');
  }
}

runTests();
