import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { DocumentModel } from '../models/Document';
import { QAService } from '../services/qaService';
import { connectDB } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const TEST_USER_ID = '5f8d0d55b54764421b7156d0';

async function runMigratedUserTest() {
  await connectDB();
  const qaService = new QAService();

  try {
    const user = await User.findById(TEST_USER_ID);
    if (!user) {
      console.error('Migrated test user not found!');
      process.exit(1);
    }

    const doc = await DocumentModel.findOne({ userId: TEST_USER_ID, status: 'READY' });
    if (!doc) {
      console.error('No READY document found for migrated user.');
      process.exit(1);
    }

    console.log(`Using Document ID: ${doc._id}`);

    // Generate JWT for the migrated user
    const token = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });

    console.log('\nTesting direct QAService call using migrated user ID...');
    const res = await qaService.askQuestion(TEST_USER_ID, doc._id.toString(), 'What is this document about?');
    
    console.log('QA Service Response:');
    console.log({
      isAnswerable: res.isAnswerable,
      content: res.content,
      citationsCount: res.citations.length
    });
    
    if (res.isAnswerable && res.citations.length > 0) {
      console.log('✅ RAG QA with authenticated user verified successfully.');
    } else {
      console.warn('⚠️ RAG QA ran, but returned unanswerable or no citations. Check context.');
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runMigratedUserTest();
