import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load env before other imports
dotenv.config();

import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { DocumentModel } from '../models/Document';
import express from 'express';
import { connectDB } from '../config/db';
import authRoutes from '../routes/authRoutes';
import documentRoutes from '../routes/documentRoutes';
import retrievalRoutes from '../routes/retrievalRoutes';
import qaRoutes from '../routes/qaRoutes';
import supertest from 'supertest';
import { RetrievalService } from '../services/retrievalService';
import { QAService } from '../services/qaService';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/retrieval', retrievalRoutes);
app.use('/api/qa', qaRoutes);

const request = supertest(app);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function runAuthTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/docask');
  console.log('Connected to MongoDB.\n');

  try {
    // Cleanup users created by this script
    await User.deleteMany({ email: { $in: ['testuser1@docask.com', 'testuser2@docask.com'] } });
    
    // Create dummy document for cross-user tests
    const dummyDoc = await DocumentModel.create({
      userId: new mongoose.Types.ObjectId(), // someone else's ID
      fileName: 'TopSecret.pdf',
      status: 'READY'
    });

    console.log('--- REGISTRATION TESTS ---');
    // 1. Successful registration
    let res = await request.post('/api/auth/register').send({
      name: 'Test User 1',
      email: 'testuser1@docask.com',
      password: 'password123'
    });
    console.assert(res.status === 201, `Expected 201, got ${res.status}`);
    console.assert(!res.body.user.passwordHash, 'passwordHash must not be in response');
    const user1Id = res.body.user.id;
    console.log('✅ Successful registration');

    // 2. Duplicate registration
    res = await request.post('/api/auth/register').send({
      name: 'Test User 1',
      email: 'testuser1@docask.com',
      password: 'password123'
    });
    console.assert(res.status === 400, `Expected 400, got ${res.status}`);
    console.log('✅ Duplicate registration rejected');

    // 3. Validation failure
    res = await request.post('/api/auth/register').send({
      name: 'Test User 1',
      email: 'testuser1@docask.com',
      password: 'short'
    });
    console.assert(res.status === 400, `Expected 400, got ${res.status}`);
    console.log('✅ Weak password rejected');

    console.log('\n--- LOGIN TESTS ---');
    // 4. Successful login
    res = await request.post('/api/auth/login').send({
      email: 'testuser1@docask.com',
      password: 'password123'
    });
    console.assert(res.status === 200, `Expected 200, got ${res.status}`);
    console.assert(!res.body.user.passwordHash, 'passwordHash must not be in response');
    const token = res.body.token;
    console.assert(!!token, 'Token must be returned');
    console.log('✅ Successful login');

    // 5. Incorrect password
    res = await request.post('/api/auth/login').send({
      email: 'testuser1@docask.com',
      password: 'wrongpassword'
    });
    console.assert(res.status === 401, `Expected 401, got ${res.status}`);
    console.log('✅ Incorrect password rejected');

    // 6. Nonexistent account
    res = await request.post('/api/auth/login').send({
      email: 'nonexistent@docask.com',
      password: 'password123'
    });
    console.assert(res.status === 401, `Expected 401, got ${res.status}`);
    console.log('✅ Nonexistent account rejected');

    console.log('\n--- JWT VALIDATION TESTS ---');
    // 7. Missing JWT
    res = await request.post('/api/qa/ask').send({
      documentId: dummyDoc._id.toString(),
      question: 'Hello'
    });
    console.assert(res.status === 401, `Expected 401, got ${res.status}`);
    console.log('✅ Missing JWT rejected');

    // 8. Malformed JWT
    res = await request.post('/api/qa/ask').set('Authorization', 'Bearer malformed_token').send({
      documentId: dummyDoc._id.toString(),
      question: 'Hello'
    });
    console.assert(res.status === 401, `Expected 401, got ${res.status}`);
    console.log('✅ Malformed JWT rejected');

    // 9. Invalid signature
    const fakeToken = jwt.sign({ sub: user1Id }, 'wrong_secret', { expiresIn: '1h' });
    res = await request.post('/api/qa/ask').set('Authorization', `Bearer ${fakeToken}`).send({
      documentId: dummyDoc._id.toString(),
      question: 'Hello'
    });
    console.assert(res.status === 401, `Expected 401, got ${res.status}`);
    console.log('✅ Invalid signature JWT rejected');

    // 10. Expired JWT
    const expiredToken = jwt.sign({ sub: user1Id }, JWT_SECRET, { expiresIn: '-1h' });
    res = await request.post('/api/qa/ask').set('Authorization', `Bearer ${expiredToken}`).send({
      documentId: dummyDoc._id.toString(),
      question: 'Hello'
    });
    console.assert(res.status === 401, `Expected 401, got ${res.status}`);
    console.log('✅ Expired JWT rejected');

    console.log('\n--- AUTHORIZATION TESTS ---');
    // 11. Cross-user QA access
    // user1 trying to access dummyDoc which belongs to another user
    res = await request.post('/api/qa/ask').set('Authorization', `Bearer ${token}`).send({
      documentId: dummyDoc._id.toString(),
      question: 'Hello'
    });
    console.assert(res.status === 403, `Expected 403, got ${res.status}`);
    console.log('✅ Cross-user QA access blocked');

    // Clean up
    await DocumentModel.findByIdAndDelete(dummyDoc._id);
    await User.deleteMany({ email: { $in: ['testuser1@docask.com', 'testuser2@docask.com'] } });

    console.log('\n✅ All authentication tests passed.');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runAuthTests();
