

import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as mongoose from 'mongoose';
import { createWallet, getWallet } from '../controllers/wallet.controller.js';


const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/sui_will', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
} as any).then(() => {
  console.log('✅ Connected to database');
}).catch(err => {
  console.error('❌ Database connection error:', err);
});

// Routes
app.post('/wallet/create', createWallet);
app.get('/wallet/:userId', getWallet);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
