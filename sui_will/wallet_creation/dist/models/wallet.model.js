"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletModel = void 0;
const mongoose_1 = require("mongoose");
const walletSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    address: { type: String, required: true },
    encryptedPrivateKey: { type: String, required: true },
    privateKeyIv: { type: String, required: true },
    encryptedMnemonic: { type: String, required: true },
    mnemonicIv: { type: String, required: true },
    salt: { type: String, required: true },
}, { timestamps: true });
exports.WalletModel = (0, mongoose_1.model)('Wallet', walletSchema);
