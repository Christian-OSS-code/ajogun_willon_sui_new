import mongoose, { Schema, Document } from 'mongoose';

export interface IWillDetailsRef extends Document {
  userId: string;
  ownerAddress: string;
  willIndex: number;
  storageId: string;
  createdAt: Date;
  isActive: boolean;
}

const WillDetailsRefSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  ownerAddress: { type: String, required: true, index: true },
  willIndex: { type: Number, required: true },
  storageId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});
WillDetailsRefSchema.index({ ownerAddress: 1, willIndex: 1 }, { unique: true });

export const WillDetailsRefModel = mongoose.model<IWillDetailsRef>('WillDetailsRef', WillDetailsRefSchema);