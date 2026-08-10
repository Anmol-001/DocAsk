import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IMessage extends MongooseDocument {
  conversationId: mongoose.Types.ObjectId;
  role: 'user' | 'ai';
  content: string;
  isAnswerable?: boolean;
  citations?: {
    documentId: mongoose.Types.ObjectId;
    chunkId: mongoose.Types.ObjectId;
    pageStart: number;
    pageEnd: number;
    score: number;
  }[];
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  role: { type: String, enum: ['user', 'ai'], required: true },
  content: { type: String, required: true },
  isAnswerable: { type: Boolean },
  citations: [{
    documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
    chunkId: { type: Schema.Types.ObjectId, ref: 'DocumentChunk' },
    pageStart: Number,
    pageEnd: Number,
    score: Number
  }],
  createdAt: { type: Date, default: Date.now },
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
