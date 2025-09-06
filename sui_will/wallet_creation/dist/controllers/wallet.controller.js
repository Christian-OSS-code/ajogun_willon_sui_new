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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferTokens = exports.getBalance = exports.getWallet = exports.createWallet = void 0;
const client_1 = require("@mysten/sui/client");
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const crypto_1 = require("../utils/crypto");
const wallet_model_1 = require("../models/wallet.model");
const crypto = __importStar(require("crypto"));
const dotenv = __importStar(require("dotenv"));
const transactions_1 = require("@mysten/sui/transactions");
dotenv.config();
const client = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
// export const createWallet = async (req: express.Request, res: express.Response) => {
//   try {
//     const { userId, password } = req.body;
//     if (!userId || !password || typeof userId !== 'string' || typeof password !== 'string') {
//       return res.status(400).json({ message: 'Invalid userId or password' });
//     }
//     const mnemonic = generateMnemonic();
//     const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
//     const address = keypair.getPublicKey().toSuiAddress();
//     // const privateKeyBase64 = Buffer.from(keypair.getSecretKey()).toString('base64');
//     const rawPrivateKey = keypair.getSecretKey().slice(0, 32);
//     const privateKeyBase64 = Buffer.from(rawPrivateKey).toString('base64');
//     const salt = crypto.randomBytes(16).toString('hex');
//     const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(privateKeyBase64, password, salt);
//     const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);
//     // const wallet = new WalletModel({
//     //   userId,
//     //   address,
//     //   encryptedPrivateKey,
//     //   privateKeyIv,
//     //   encryptedMnemonic,
//     //   mnemonicIv,
//     //   salt,
//     // });
//     // await wallet.save();
//     const wallet = new WalletModel({
//   userId,
//   address,
//   encryptedPrivateKey,
//   privateKeyIv,
//   encryptedMnemonic,
//   mnemonicIv,
//   salt,
// });
// await wallet.save();
// console.log("✅ Wallet saved:", wallet);
//     console.log(' Wallet Created:', { userId, address });
//     return res.status(201).json({
//       address,
//       mnemonic,
//       message: 'Wallet created successfully. Save your mnemonic securely!',
//     });
//   } catch (error) {
//     console.error('Wallet creation failed:', error);
//     return res.status(500).json({ message: 'Error creating wallet' });
//   }
// };
// src/controllers/wallet.controller.ts
const createWallet = async (req, res) => {
    try {
        const { password, userId } = req.body;
        // Generate new wallet
        const keypair = new ed25519_1.Ed25519Keypair();
        const publicKey = keypair.getPublicKey().toSuiAddress();
        const secretKey = keypair.getSecretKey(); // FULL 64-byte secret key
        const privateKeyBytes = secretKey.slice(0, 32); // First 32 bytes for private key
        const privateKeyBase64 = Buffer.from(privateKeyBytes).toString('base64');
        const mnemonic = (0, crypto_1.generateMnemonic)();
        // Encrypt private key
        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = (0, crypto_1.encrypt)(privateKeyBase64, password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = (0, crypto_1.encrypt)(mnemonic, password, salt);
        const wallet = new wallet_model_1.WalletModel({
            userId,
            address: publicKey,
            encryptedPrivateKey,
            privateKeyIv,
            encryptedMnemonic,
            mnemonicIv,
            salt,
        });
        await wallet.save();
        res.json({
            message: 'Wallet created successfully. Save your mnemonic securely!',
            address: publicKey,
            mnemonic, // Return mnemonic for user to save securely
        });
    }
    catch (err) {
        console.error("Error creating wallet:", err);
        res.status(500).json({ message: "Error creating wallet" });
    }
};
exports.createWallet = createWallet;
const getWallet = async (req, res) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;
        if (!userId || !password) {
            return res.status(400).json({ message: 'Missing userId or password' });
        }
        const wallet = await wallet_model_1.WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
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
const getBalance = async (req, res) => {
    try {
        const { userId } = req.params;
        const wallet = await wallet_model_1.WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
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
// export const transferTokens = async (req: express.Request, res: express.Response) => {
//     try {
//       const { userId } = req.params;
//       const {recipient, amount, password} = req.body;
//       if (!userId || !recipient || !amount || !password) {
//         return res.status(400).json({ message: 'Missing userId, recipient, amount, or password' });
//       }
//       if (!recipient.startsWith('0x') || recipient.length !== 66) {
//         return res.status(400).json({ message: 'Invalid recipient address' });
//       }
//       const amountNum = parseInt(amount);
//       if (isNaN(amountNum) || amountNum <= 0) {
//         return res.status(400).json({ message: 'Invalid amount' });
//       }
//       const wallet = await WalletModel.findOne({ userId });
//       if (!wallet) {
//         return res.status(404).json({ message: 'Wallet not found' });
//       }
//       const privateKeyBase64 = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
//       const privateKey = Buffer.from(privateKeyBase64, 'base64');
//       const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKey));
//       // const tx = new Transaction();
//       // const [coin] = tx.splitCoins(tx.gas, [amountNum]);
//       // tx.transferObjects([coin], recipient);
//       // tx.setGasBudget(1000000);
//       const coins = await client.getCoins({ owner: wallet.address, coinType: '0x2::sui::SUI' });
//       if (!coins.data.length) {
//       return res.status(400).json({ message: 'No SUI coins available for gas' });
//     }
//     const gasCoinId = coins.data[0].coinObjectId;
//     const tx = new Transaction();
//       tx.setGasPayment([
//         {
//           objectId: gasCoinId,
//           version: coins.data[0].version,
//           digest: coins.data[0].digest,
//         },
//     ]);
//     const [coin] = tx.splitCoins(tx.gas, [amountNum]);
//     tx.transferObjects([coin], recipient);
//     tx.setGasBudget(1000000);
//     const result = await client.signAndExecuteTransaction({
//     transaction: tx,
//     signer: keypair,
//     });
//       // const result = await client.signAndExecuteTransaction({
//       //   transaction: tx,
//       //   signer: keypair,
//       // });
//         return res.status(200).json({
//         transactionDigest: result.digest,
//         message: `Transferred ${amountNum} MIST to ${recipient}`,
//       });
//     } catch (error) {
//       console.error('Token transfer failed:', error);
//       return res.status(500).json({ message: 'Error transferring tokens' });
//     }
//   };
// src/controllers/wallet.controller.ts
const transferTokens = async (req, res) => {
    try {
        const { userId } = req.params;
        const { recipient, amount, password } = req.body;
        console.log("Transfer Request:", { userId, recipient, amount });
        const wallet = await wallet_model_1.WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found" });
        }
        console.log("✅ Wallet found:", wallet.address);
        console.log("salt:", wallet.salt);
        console.log("IV:", wallet.privateKeyIv);
        try {
            // Decrypt private key
            const privateKeyBase64 = (0, crypto_1.decrypt)(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
            const privateKeyBytes = Buffer.from(privateKeyBase64, 'base64');
            const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(privateKeyBytes);
            // Build transaction
            const tx = new transactions_1.Transaction();
            const [coinToTransfer] = tx.splitCoins(tx.gas, [parseInt(amount)]);
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
                amount,
            });
        }
        catch (decryptionError) {
            console.error("Decryption failed:", decryptionError);
            return res.status(401).json({ message: "Invalid password or decryption error" });
        }
    }
    catch (err) {
        console.error("Token transfer failed:", err);
        res.status(500).json({ message: "Error transferring tokens" });
    }
};
exports.transferTokens = transferTokens;
//   const coins = await client.getCoins({ owner: wallet.address, coinType: '0x2::sui::SUI' });
// if (!coins.data.length) {
//   return res.status(400).json({ message: 'No SUI coins available for gas' });
// }
// const gasCoinId = coins.data[0].coinObjectId;
// const tx = new Transaction();
// tx.setGasPayment([
//   {
//     objectId: gasCoinId,
//     version: coins.data[0].version,
//     digest: coins.data[0].digest,
//   },
// ]);
// const [coin] = tx.splitCoins(tx.gas, [amountNum]);
// tx.transferObjects([coin], recipient);
// tx.setGasBudget(1000000);
// const result = await client.signAndExecuteTransaction({
//   transaction: tx,
//   signer: keypair,
// });
