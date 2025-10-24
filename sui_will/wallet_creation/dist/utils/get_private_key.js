"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("./crypto");
const wallet_model_1 = require("../models/wallet.model");
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const getPrivateKey = async (userId, password) => {
    if (!process.env.MONGODB_URI) {
        throw new Error('Missing environment variable: MONGODB_URI');
    }
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    const wallet = await wallet_model_1.WalletModel.findOne({ userId });
    if (!wallet) {
        throw new Error("Wallet not found. Please ensure you have created this wallet and the database is accessible.");
    }
    const privateKey = (0, crypto_1.decrypt)(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
    console.log("Your Private Key (DO NOT SHARE):", privateKey);
    await mongoose_1.default.disconnect();
};
const [node, script, userId, password] = process.argv;
if (!userId || !password) {
    console.error("Usage: ts-node src/utils/get_private_key.ts <userId> <password>");
    process.exit(1);
}
getPrivateKey(userId, password);
