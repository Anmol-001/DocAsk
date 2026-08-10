import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocumentChunk extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  chunkIndex: number;
  text: string;
  pageStart: number;
  pageEnd: number;
  charCount: number;
  embedding?: number[];
  createdAt: Date;
}

const DocumentChunkSchema: Schema = new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  pageStart: { type: Number, required: true },
  pageEnd: { type: Number, required: true },
  charCount: { type: Number, required: true },
  embedding: { type: [Number] },
  createdAt: { type: Date, default: Date.now },
});

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
