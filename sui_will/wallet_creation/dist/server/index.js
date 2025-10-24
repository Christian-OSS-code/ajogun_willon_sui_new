"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helmet_1 = __importDefault(require("helmet"));
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const wallet_controller_1 = require("../controllers/wallet.controller");
const wil_router_1 = __importDefault(require("../routes/wil_router"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
prisma.$connect()
    .then(() => {
    console.log('✅ Connected to Prisma database');
    return { message: '✅ Connected to Prisma database' };
})
    .catch((err) => {
    console.error('❌ Prisma database connection error:', err);
    return { error: err };
});
const app = (0, express_1.default)();
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
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
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
app.post('/wallet/create', wallet_controller_1.createWallet);
app.get('/wallet/:userId', wallet_controller_1.getWallet);
app.get('/wallet/:userId/balance', wallet_controller_1.getBalance);
app.post('/wallet/:userId/transfer', wallet_controller_1.transferTokens);
app.post('/wallet/verify-activate', wallet_controller_1.verifyAndActivateWallet);
app.post('/wallet/activate-alternative', wallet_controller_1.activateWalletAlternative);
app.post('/wallet/import', wallet_controller_1.importWallet);
app.get('/wallet/:userId/status', wallet_controller_1.getWalletStatus);
app.use('/will', wil_router_1.default);
app.use('/will', wil_router_1.default);
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
    });
});
app.use((error, req, res, next) => {
    console.error('🚨 Error:', error);
    res.status(error.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Something went wrong!'
            : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
exports.default = app;
