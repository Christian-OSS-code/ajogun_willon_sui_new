

import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createWallet, getWallet, getBalance, transferTokens } from '../controllers/wallet.controller';
import willRoutes from '../routes/wil_router';


dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error('Missing environment variable: MONGODB_URI');
}

const app = express();
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to database');
  })
  .catch((err) => {
    console.error(' Database connection error:', err);
  });

app.post('/wallet/create', createWallet);
app.get('/wallet/:userId', getWallet);
app.get('/wallet/:userId/balance', getBalance);
app.post('/wallet/:userId/transfer', transferTokens);
app.use('/will', willRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



