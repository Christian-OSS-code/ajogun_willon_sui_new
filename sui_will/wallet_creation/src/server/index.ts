import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { createWallet, getWallet, getBalance, transferTokens } from '../controllers/wallet.controller';
import { createWill, initiateWillExecution, executeWill, revokeWill, checkWillReadyForExecution, updateActivity, executeWillAutomatically, getMonitoredWills, getAllWills } from '../controllers/will.controller';
import willRoutes from '../routes/wil_router';

dotenv.config();


if (!process.env.MONGODB_URI) {
  throw new Error('Missing environment variable: MONGODB_URI');
}

const app = express();

const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to database'))
  .catch((err) => console.error('Database connection error:', err));  

app.get('/', (req, res) => {
  res.send('✅ API is running...');
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