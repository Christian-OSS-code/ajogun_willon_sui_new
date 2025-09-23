import helmet from 'helmet';
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

// ✅ CORS should come first
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://your-frontend-domain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ✅ Then Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ✅ Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ DB connect
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to database'))
  .catch((err) => console.error('❌ Database connection error:', err));

// ✅ Routes
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '✅ API is running...',
    version: '1.0.0',
    documentation: '/api/docs',
  });
});

// Wallet
app.post('/wallet/create', createWallet);
app.get('/wallet/:userId', getWallet);
app.get('/wallet/:userId/balance', getBalance);
app.post('/wallet/:userId/transfer', transferTokens);

// Wills
app.use('/will', willRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handler
app.use(
  (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('🚨 Error:', error);
    res.status(error.status || 500).json({
      error:
        process.env.NODE_ENV === 'production'
          ? 'Something went wrong!'
          : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;