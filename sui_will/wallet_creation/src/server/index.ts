

import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import walletController from '../controllers/wallet.controller';

dotenv.config();
console.log('WALRUS_URI:', process.env.WALRUS_URI);
console.log('Wallet Controller:', walletController);

if (!process.env.MONGODB_URI) {
  throw new Error('Missing environment variable: MONGODB_URI');
}

const app = express();
app.use(express.json());

if (!process.env.WALRUS_URI) {
  throw new Error('Missing environment variable: WALRUS_URI');
}

mongoose
  .connect(process.env.WALRUS_URI!)
  .then(() => {
    console.log('Connected to database');
  })
  .catch((err) => {
    console.error(' Database connection error:', err);
  });

app.post('/wallet/create', walletController.createWallet);
app.get('/wallet/:userId', walletController.getWallet);
app.get('/wallet/:userId/balance', walletController.getBalance);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});