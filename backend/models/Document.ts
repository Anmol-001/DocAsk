import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  status: 'UPLOADED' | 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'READY' | 'PROCESSING_FAILED';
  errorMessage?: string;
  uploadedAt: Date;
}

const DocumentSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  status: { type: String, enum: ['UPLOADED', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'READY', 'PROCESSING_FAILED'], default: 'UPLOADED' },
  errorMessage: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
