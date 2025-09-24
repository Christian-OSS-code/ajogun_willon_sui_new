
import { Schema, model } from 'mongoose';

export interface IWallet {
  userId: string;
  address: string;
  encryptedPrivateKey: string;
  privateKeyIv: string;
  encryptedMnemonic: string;
  mnemonicIv: string;
  salt: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    userId: { type: String, required: true },
    address: { type: String, required: true },
    encryptedPrivateKey: { type: String, required: true },
    privateKeyIv: { type: String, required: true },
    encryptedMnemonic: { type: String, required: true },
    mnemonicIv: { type: String, required: true },
    isActive: { type: Boolean, default: false, required: true },
  
    salt: { type: String, required: true },
  },
  { timestamps: true }
);

export const WalletModel = model<IWallet>('Wallet', walletSchema);
