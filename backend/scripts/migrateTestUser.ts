import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { DocumentModel } from '../models/Document';
import { Conversation } from '../models/Conversation';

// Load environment variables from .env
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docask';

async function migrateTestUser() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const TEST_USER_ID = '5f8d0d55b54764421b7156d0';
  const email = process.env.MIGRATION_TEST_EMAIL;
  const rawPassword = process.env.MIGRATION_TEST_PASSWORD;

  if (!email || !rawPassword) {
    console.error('ERROR: MIGRATION_TEST_EMAIL and MIGRATION_TEST_PASSWORD must be defined in .env');
    process.exit(1);
  }

  try {
    // 1. Verify target user does not already exist
    const existingUserById = await User.findById(TEST_USER_ID);
    if (existingUserById) {
      console.log(`User with ID ${TEST_USER_ID} already exists. No migration needed.`);
      process.exit(0);
    }

    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      console.error(`ERROR: User with email ${email} already exists under a different ID. Aborting to avoid overwriting unrelated user.`);
      process.exit(1);
    }

    // 2. Inspect existing documents/conversations referencing it
    const docCount = await DocumentModel.countDocuments({ userId: TEST_USER_ID });
    const convCount = await Conversation.countDocuments({ userId: TEST_USER_ID });
    console.log(`Found ${docCount} existing documents and ${convCount} existing conversations referencing the test user ID.`);

    // 3. Hash password and create user
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const newUser = await User.create({
      _id: TEST_USER_ID,
      email,
      name: 'Test User',
      passwordHash
    });

    console.log(`Successfully migrated test user with ID ${newUser._id}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

migrateTestUser();
