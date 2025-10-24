"use strict";
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
const wallet_model_1 = require("../models/wallet.model");
const crypto = __importStar(require("crypto"));
const dotenv = __importStar(require("dotenv"));
const transactions_1 = require("@mysten/sui/transactions");
dotenv.config();
const client = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
const createWallet = async (req, res) => {
    try {
        const { password, userId } = req.body;
        const mnemonic = (0, crypto_1.generateMnemonic)();
        const keypair = ed25519_1.Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        const secretKeyString = keypair.getSecretKey();
        console.log("Wallet created with mnemonic:", mnemonic);
        console.log("Derived address:", publicKey);
        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = (0, crypto_1.encrypt)(secretKeyString, password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = (0, crypto_1.encrypt)(mnemonic, password, salt);
        const wallet = new wallet_model_1.WalletModel({
            userId,
            address: publicKey,
            encryptedPrivateKey,
            privateKeyIv,
            encryptedMnemonic,
            mnemonicIv,
            salt,
            isActive: false,
        });
        await wallet.save();
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
        console.log("🔍 Searching for wallet with userId:", userId);
        console.log("📩 Received data:", { userId, mnemonicLength: mnemonic?.length });
        const wallet = await wallet_model_1.WalletModel.findOne({ userId });
        if (!wallet) {
            console.log("❌ No wallet found for userId:", userId);
            const allWallets = await wallet_model_1.WalletModel.find({});
            console.log("📋 All wallets in database:", allWallets.map(w => ({ userId: w.userId, address: w.address })));
            return res.status(404).json({
                message: 'Wallet not found. Please create a wallet first.'
            });
        }
        console.log("✅ Found wallet:", {
            userId: wallet.userId,
            address: wallet.address,
            isActive: wallet.isActive,
            hasIsActiveField: 'isActive' in wallet
        });
        const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
        console.log("🔐 Normalized mnemonic:", JSON.stringify(normalizedMnemonic));
        if (wallet.isActive === true) {
            console.log("ℹ️ Wallet is already active");
            return res.status(400).json({
                message: 'Wallet is already activated.'
            });
        }
        console.log("🔐 Verifying mnemonic...");
        const keypairFromMnemonic = ed25519_1.Ed25519Keypair.deriveKeypair(normalizedMnemonic);
        const derivedAddress = keypairFromMnemonic.getPublicKey().toSuiAddress();
        console.log("📬 Derived address from mnemonic:", derivedAddress);
        console.log("🏦 Stored wallet address:", wallet.address);
        if (derivedAddress !== wallet.address) {
            console.log("❌ Mnemonic verification failed - addresses don't match");
            try {
                const storedMnemonic = (0, crypto_1.decrypt)(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
                console.log("🔍 Stored mnemonic (decrypted):", JSON.stringify(storedMnemonic));
                console.log("🔍 Mnemonic match:", storedMnemonic === normalizedMnemonic);
            }
            catch (decryptError) {
                console.log("🔍 Could not decrypt stored mnemonic:", decryptError);
            }
            return res.status(400).json({
                message: 'Invalid mnemonic. The mnemonic does not match the wallet address.'
            });
        }
        console.log("✅ Mnemonic verified successfully");
        console.log("🚀 Activating wallet...");
        wallet.isActive = true;
        await wallet.save();
        console.log("🎉 Wallet activated successfully for userId:", userId);
        res.json({
            message: 'Wallet activated successfully! Your mnemonic has been verified.',
            address: wallet.address,
            activated: true
        });
    }
    catch (err) {
        console.error("💥 Error activating wallet:", err);
        res.status(500).json({ message: "Error activating wallet: " + (err instanceof Error ? err.message : String(err)) });
    }
};
exports.verifyAndActivateWallet = verifyAndActivateWallet;
const importWallet = async (req, res) => {
    try {
        const { userId, mnemonic, password } = req.body;
        const keypair = ed25519_1.Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        const existingWallet = await wallet_model_1.WalletModel.findOne({ userId });
        if (existingWallet) {
            return res.status(400).json({
                message: 'Wallet already exists for this user.'
            });
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = (0, crypto_1.encrypt)(keypair.getSecretKey(), password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = (0, crypto_1.encrypt)(mnemonic, password, salt);
        const wallet = new wallet_model_1.WalletModel({
            userId,
            address: publicKey,
            encryptedPrivateKey,
            privateKeyIv,
            encryptedMnemonic,
            mnemonicIv,
            salt,
            isActive: true,
        });
        await wallet.save();
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
        const wallet = await wallet_model_1.WalletModel.findOne({ userId, isActive: true });
        if (!wallet) {
            return res.status(404).json({
                message: 'Wallet not found or not activated. Please verify your mnemonic first.'
            });
        }
        const balance = await client.getBalance({ owner: wallet.address });
        return res.status(200).json({
            address: wallet.address,
            balance: balance.totalBalance,
            message: 'Balance fetched successfully',
        });
    }
    catch (error) {
        console.error('Balance fetch failed:', error);
        return res.status(500).json({ message: 'Error fetching balance' });
    }
};
exports.getBalance = getBalance;
const transferTokens = async (req, res) => {
    try {
        const { userId } = req.params;
        const { recipient, amount, password } = req.body;
        const wallet = await wallet_model_1.WalletModel.findOne({ userId, isActive: true });
        if (!wallet) {
            return res.status(404).json({
                message: "Wallet not found or not activated. Please verify your mnemonic first."
            });
        }
        try {
            const privateKeyString = (0, crypto_1.decrypt)(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
            console.log("Decrypted private key string:", privateKeyString);
            console.log("Decrypted key type:", typeof privateKeyString);
            console.log("Decrypted key length:", privateKeyString.length);
            const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(privateKeyString);
            const derivedAddress = keypair.getPublicKey().toSuiAddress();
            if (derivedAddress !== wallet.address) {
                return res.status(401).json({ message: "Key derivation error: addresses don't match" });
            }
            const balance = await client.getBalance({ owner: wallet.address });
            const amountNum = parseInt(amount);
            if (parseInt(balance.totalBalance) < amountNum) {
                return res.status(400).json({
                    message: `Insufficient balance. Available: ${balance.totalBalance} MIST, Required: ${amountNum} MIST`
                });
            }
            const tx = new transactions_1.Transaction();
            const [coinToTransfer] = tx.splitCoins(tx.gas, [amountNum]);
            tx.transferObjects([coinToTransfer], recipient);
            tx.setGasBudget(10000000);
            const result = await client.signAndExecuteTransaction({
                signer: keypair,
                transaction: tx,
            });
            res.json({
                message: "Transfer successful",
                transactionDigest: result.digest,
                from: wallet.address,
                to: recipient,
                amount: amountNum,
            });
        }
        catch (decryptionError) {
            console.error("Decryption failed:", decryptionError);
            return res.status(401).json({ message: "Invalid password or decryption error" });
        }
    }
    catch (err) {
        console.error("Token transfer failed:", err);
        res.status(500).json({ message: "Error transferring tokens: " + (err instanceof Error ? err.message : String(err)) });
    }
};
exports.transferTokens = transferTokens;
const getWallet = async (req, res) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;
        if (!userId || !password) {
            return res.status(400).json({ message: 'Missing userId or password' });
        }
        const wallet = await wallet_model_1.WalletModel.findOne({ userId, isActive: true });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found or not activated' });
        }
        let mnemonic = null;
        if (req.query.includeMnemonic === 'true') {
            try {
                mnemonic = (0, crypto_1.decrypt)(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
            }
            catch (error) {
                return res.status(401).json({ message: 'Invalid password' });
            }
        }
        return res.status(200).json({
            address: wallet.address,
            mnemonic,
            message: 'Wallet fetched successfully',
        });
    }
    catch (error) {
        console.error('Wallet fetch failed:', error);
        return res.status(500).json({ message: 'Error fetching wallet' });
    }
};
exports.getWallet = getWallet;
const getWalletStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const wallet = await wallet_model_1.WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
        }
        const isActive = wallet.isActive;
        return res.status(200).json({
            address: wallet.address,
            isActive: isActive || false,
            message: 'Wallet status fetched successfully',
        });
    }
    catch (error) {
        console.error('Wallet status fetch failed:', error);
        return res.status(500).json({ message: 'Error fetching wallet status' });
    }
};
exports.getWalletStatus = getWalletStatus;
const activateWalletAlternative = async (req, res) => {
    try {
        const { userId, mnemonic, password } = req.body;
        const wallet = await wallet_model_1.WalletModel.findOne({ userId, isActive: false });
        if (!wallet) {
            return res.status(404).json({
                message: 'Wallet not found or already activated.'
            });
        }
        const keypairFromMnemonic = ed25519_1.Ed25519Keypair.deriveKeypair(mnemonic);
        const derivedAddress = keypairFromMnemonic.getPublicKey().toSuiAddress();
        if (derivedAddress !== wallet.address) {
            return res.status(400).json({
                message: 'Invalid mnemonic.'
            });
        }
        await wallet_model_1.WalletModel.updateOne({ _id: wallet._id }, { $set: { isActive: true } });
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
        const result = await wallet_model_1.WalletModel.updateMany({ isActive: { $exists: false } }, { $set: { isActive: false } });
        console.log(`✅ Migrated ${result.modifiedCount} wallets to include isActive field`);
    }
    catch (error) {
        console.error('❌ Wallet migration failed:', error);
    }
};
exports.migrateWallets = migrateWallets;
const exportToSuiCLI = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const wallet = await wallet_model_1.WalletModel.findOne({ userId, isActive: true });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
        }
        const mnemonic = (0, crypto_1.decrypt)(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
        res.json({
            message: 'Use this mnemonic to import into Sui CLI:',
            mnemonic: mnemonic,
            suiCLICommand: `sui keytool import "${mnemonic}" ed25519`
        });
    }
    catch (error) {
        console.error('Export failed:', error);
        res.status(500).json({ message: 'Error exporting wallet' });
    }
};
exports.exportToSuiCLI = exportToSuiCLI;
