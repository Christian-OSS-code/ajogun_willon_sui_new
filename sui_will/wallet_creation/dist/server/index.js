"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const wallet_controller_1 = require("../controllers/wallet.controller");
dotenv_1.default.config();
if (!process.env.MONGODB_URI) {
    throw new Error('Missing environment variable: MONGODB_URI');
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
mongoose_1.default
    .connect(process.env.MONGODB_URI)
    .then(() => {
    console.log('Connected to database');
})
    .catch((err) => {
    console.error(' Database connection error:', err);
});
app.post('/wallet/create', wallet_controller_1.createWallet);
app.get('/wallet/:userId', wallet_controller_1.getWallet);
app.get('/wallet/:userId/balance', wallet_controller_1.getBalance);
app.post('/wallet/:userId/transfer', wallet_controller_1.transferTokens);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
