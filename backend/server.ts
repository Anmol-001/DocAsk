import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import documentRoutes from './routes/documentRoutes';
import retrievalRoutes from './routes/retrievalRoutes';
import qaRoutes from './routes/qaRoutes';
import authRoutes from './routes/authRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Connect to MongoDB
connectDB();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/retrieval', retrievalRoutes);
app.use('/api/qa', qaRoutes);

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DocAsk API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
