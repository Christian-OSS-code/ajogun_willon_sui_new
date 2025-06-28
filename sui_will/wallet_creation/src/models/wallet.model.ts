
import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    type: String,
    required: true,
    unique: true,
  },
  encryptedPrivateKey: {
    type: String,
    required: true,
  },
  privateKeyIv: {
  
    type: String,
    required: true,
  },
  encryptedMnemonic: {
    // Add encrypted mnemonic
    type: String,
    required: true,
  },
  mnemonicIv: {
    // Add IV for mnemonic encryption
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

export const WalletModel = mongoose.model('Wallet', WalletSchema);