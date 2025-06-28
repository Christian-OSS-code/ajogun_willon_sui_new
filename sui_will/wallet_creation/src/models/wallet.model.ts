
// import mongoose from 'mongoose';

// const WalletSchema = new mongoose.Schema({
//   userId: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   address: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   encryptedPrivateKey: {
//     type: String,
//     required: true,
//   },
//   privateKeyIv: {
  
//     type: String,
//     required: true,
//   },
//   encryptedMnemonic: {
//     // Add encrypted mnemonic
//     type: String,
//     required: true,
//   },
//   mnemonicIv: {
//     // Add IV for mnemonic encryption
//     type: String,
//     required: true,
//   },
// }, {
//   timestamps: true,
// });

// export const WalletModel = mongoose.model('Wallet', WalletSchema);
import { Schema, model } from 'mongoose';

interface IWallet {
  userId: string;
  address: string;
  encryptedPrivateKey: string;
  privateKeyIv: string;
  encryptedMnemonic: string;
  mnemonicIv: string;
  salt: string;
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
    salt: { type: String, required: true },
  },
  { timestamps: true }
);

export const WalletModel = model<IWallet>('Wallet', walletSchema);