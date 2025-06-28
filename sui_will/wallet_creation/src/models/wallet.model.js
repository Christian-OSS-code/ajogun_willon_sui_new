"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletModel = void 0;
var mongoose_1 = require("mongoose");
var WalletSchema = new mongoose_1.default.Schema({
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
}, {
    timestamps: true
});
exports.WalletModel = mongoose_1.default.model('Wallet', WalletSchema);
