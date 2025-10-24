"use strict";
// import express from 'express';
// import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
// import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
// import { encrypt, decrypt, generateMnemonic } from '../utils/crypto';
// import { WalletModel, IWallet } from '../models/wallet.model';
// import * as crypto from 'crypto';
// import * as dotenv from 'dotenv';
// import { Transaction } from '@mysten/sui/transactions';
// import { prisma } from '../lib/prisma';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportToSuiCLI = exports.migrateWallets = exports.activateWalletAlternative = exports.getWalletStatus = exports.getWallet = exports.transferTokens = exports.getBalance = exports.importWallet = exports.verifyAndActivateWallet = exports.createWallet = void 0;
const client_1 = require("@mysten/sui/client");
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const crypto_1 = require("../utils/crypto");
const crypto = __importStar(require("crypto"));
const dotenv = __importStar(require("dotenv"));
const transactions_1 = require("@mysten/sui/transactions");
const prisma_1 = require("../lib/prisma");
dotenv.config();
const client = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
// ---------------- CREATE WALLET ----------------
const createWallet = async (req, res) => {
    try {
        const { password, userId } = req.body;
        const mnemonic = (0, crypto_1.generateMnemonic)();
        const keypair = ed25519_1.Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        const secretKeyString = keypair.getSecretKey();
        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = (0, crypto_1.encrypt)(secretKeyString, password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = (0, crypto_1.encrypt)(mnemonic, password, salt);
        const wallet = await prisma_1.prisma.wallet.create({
            data: {
                userId,
                address: publicKey,
                encryptedPrivateKey,
                privateKeyIv,
                encryptedMnemonic,
                mnemonicIv,
                salt,
                isActive: false
            }
        });
        res.json({
            message: 'Wallet created successfully. Please verify your mnemonic to activate.',
            address: publicKey,
            mnemonic,
            requiresVerification: true
        });
    }
    catch (err) {
        console.error("Error creating wallet:", err);
        res.status(500).json({ message: "Error creating wallet" });
    }
};
exports.createWallet = createWallet;
const verifyAndActivateWallet = async (req, res) => {
    try {
        const { userId, mnemonic, password } = req.body;
        const wallet = await prisma_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found. Please create a wallet first.' });
        }
        if (wallet.isActive) {
            return res.status(400).json({ message: 'Wallet is already activated.' });
        }
        const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
        const keypairFromMnemonic = ed25519_1.Ed25519Keypair.deriveKeypair(normalizedMnemonic);
        const derivedAddress = keypairFromMnemonic.getPublicKey().toSuiAddress();
        if (derivedAddress !== wallet.address) {
            try {
                const storedMnemonic = (0, crypto_1.decrypt)(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
                console.log("Stored mnemonic:", storedMnemonic);
            }
            catch { }
            return res.status(400).json({ message: 'Invalid mnemonic. The mnemonic does not match the wallet address.' });
        }
        await prisma_1.prisma.wallet.update({
            where: { userId },
            data: { isActive: true }
        });
        res.json({
            message: 'Wallet activated successfully! Your mnemonic has been verified.',
            address: wallet.address,
            activated: true
        });
    }
    catch (err) {
        console.error("Error activating wallet:", err);
        res.status(500).json({ message: "Error activating wallet" });
    }
};
exports.verifyAndActivateWallet = verifyAndActivateWallet;
const importWallet = async (req, res) => {
    try {
        const { userId, mnemonic, password } = req.body;
        const existingWallet = await prisma_1.prisma.wallet.findUnique({ where: { userId } });
        if (existingWallet) {
            return res.status(400).json({ message: 'Wallet already exists for this user.' });
        }
        const keypair = ed25519_1.Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = (0, crypto_1.encrypt)(keypair.getSecretKey(), password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = (0, crypto_1.encrypt)(mnemonic, password, salt);
        await prisma_1.prisma.wallet.create({
            data: {
                userId,
                address: publicKey,
                encryptedPrivateKey,
                privateKeyIv,
                encryptedMnemonic,
                mnemonicIv,
                salt,
                isActive: true
            }
        });
        res.json({
            message: 'Wallet imported and activated successfully!',
            address: publicKey,
            activated: true
        });
    }
    catch (err) {
        console.error("Error importing wallet:", err);
        res.status(500).json({ message: "Error importing wallet. Invalid mnemonic?" });
    }
};
exports.importWallet = importWallet;
const getBalance = async (req, res) => {
    try {
        const { userId } = req.params;
        const wallet = await prisma_1.prisma.wallet.findFirst({ where: { userId, isActive: true } });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found or not activated.' });
        }
        const balance = await client.getBalance({ owner: wallet.address });
        res.json({
            address: wallet.address,
            balance: balance.totalBalance,
            message: 'Balance fetched successfully',
        });
    }
    catch (err) {
        console.error("Balance fetch failed:", err);
        res.status(500).json({ message: 'Error fetching balance' });
    }
};
exports.getBalance = getBalance;
const transferTokens = async (req, res) => {
    try {
        const { userId } = req.params;
        const { recipient, amount, password } = req.body;
        const wallet = await prisma_1.prisma.wallet.findFirst({ where: { userId, isActive: true } });
        if (!wallet)
            return res.status(404).json({ message: "Wallet not found or not activated." });
        const privateKeyString = (0, crypto_1.decrypt)(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
        const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(privateKeyString);
        if (keypair.getPublicKey().toSuiAddress() !== wallet.address) {
            return res.status(401).json({ message: "Key derivation error: addresses don't match" });
        }
        const balance = await client.getBalance({ owner: wallet.address });
        const amountNum = parseInt(amount);
        if (parseInt(balance.totalBalance) < amountNum) {
            return res.status(400).json({ message: `Insufficient balance. Available: ${balance.totalBalance}, Required: ${amountNum}` });
        }
        const tx = new transactions_1.Transaction();
        const [coinToTransfer] = tx.splitCoins(tx.gas, [amountNum]);
        tx.transferObjects([coinToTransfer], recipient);
        tx.setGasBudget(10000000);
        const result = await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
        res.json({
            message: "Transfer successful",
            transactionDigest: result.digest,
            from: wallet.address,
            to: recipient,
            amount: amountNum
        });
    }
    catch (err) {
        console.error("Token transfer failed:", err);
        res.status(500).json({ message: "Error transferring tokens" });
    }
};
exports.transferTokens = transferTokens;
const getWallet = async (req, res) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;
        if (!userId || !password)
            return res.status(400).json({ message: 'Missing userId or password' });
        const wallet = await prisma_1.prisma.wallet.findFirst({ where: { userId, isActive: true } });
        if (!wallet)
            return res.status(404).json({ message: 'Wallet not found or not activated' });
        let mnemonic = null;
        if (req.query.includeMnemonic === 'true') {
            mnemonic = (0, crypto_1.decrypt)(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
        }
        res.json({
            address: wallet.address,
            mnemonic,
            message: 'Wallet fetched successfully',
        });
    }
    catch (err) {
        console.error("Wallet fetch failed:", err);
        res.status(500).json({ message: 'Error fetching wallet' });
    }
};
exports.getWallet = getWallet;
const getWalletStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const wallet = await prisma_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet)
            return res.status(404).json({ message: 'Wallet not found' });
        res.json({
            address: wallet.address,
            isActive: wallet.isActive || false,
            message: 'Wallet status fetched successfully',
        });
    }
    catch (err) {
        console.error("Wallet status fetch failed:", err);
        res.status(500).json({ message: 'Error fetching wallet status' });
    }
};
exports.getWalletStatus = getWalletStatus;
const activateWalletAlternative = async (req, res) => {
    try {
        const { userId, mnemonic } = req.body;
        const wallet = await prisma_1.prisma.wallet.findFirst({ where: { userId, isActive: false } });
        if (!wallet)
            return res.status(404).json({ message: 'Wallet not found or already activated.' });
        const keypairFromMnemonic = ed25519_1.Ed25519Keypair.deriveKeypair(mnemonic);
        if (keypairFromMnemonic.getPublicKey().toSuiAddress() !== wallet.address) {
            return res.status(400).json({ message: 'Invalid mnemonic.' });
        }
        await prisma_1.prisma.wallet.update({
            where: { id: wallet.id },
            data: { isActive: true }
        });
        res.json({
            message: 'Wallet activated successfully!',
            address: wallet.address,
            activated: true
        });
    }
    catch (err) {
        console.error("Error activating wallet:", err);
        res.status(500).json({ message: "Error activating wallet" });
    }
};
exports.activateWalletAlternative = activateWalletAlternative;
const migrateWallets = async () => {
    try {
        await prisma_1.prisma.wallet.updateMany({
            where: {},
            data: { isActive: false }
        });
        console.log("✅ Wallet migration completed");
    }
    catch (err) {
        console.error("❌ Wallet migration failed:", err);
    }
};
exports.migrateWallets = migrateWallets;
const exportToSuiCLI = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const wallet = await prisma_1.prisma.wallet.findFirst({ where: { userId, isActive: true } });
        if (!wallet)
            return res.status(404).json({ message: 'Wallet not found' });
        const mnemonic = (0, crypto_1.decrypt)(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
        res.json({
            message: 'Use this mnemonic to import into Sui CLI:',
            mnemonic,
            suiCLICommand: `sui keytool import "${mnemonic}" ed25519`
        });
    }
    catch (err) {
        console.error("Export failed:", err);
        res.status(500).json({ message: 'Error exporting wallet' });
    }
};
exports.exportToSuiCLI = exportToSuiCLI;
