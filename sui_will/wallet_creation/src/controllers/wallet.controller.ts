import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encrypt, decrypt, generateMnemonic } from '../utils/crypto';
import { WalletModel, IWallet } from '../models/wallet.model';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { Transaction } from '@mysten/sui/transactions';
import { Document } from 'mongoose';

dotenv.config();

const client = new SuiClient({ url: getFullnodeUrl('testnet') });
interface IWalletDocument extends IWallet, Document {
  isActive: boolean;
}

export const createWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { password, userId } = req.body;
        const mnemonic = generateMnemonic(); 
        
        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        
        const secretKeyString = keypair.getSecretKey();
        
        console.log("Wallet created with mnemonic:", mnemonic);
        console.log("Derived address:", publicKey);

        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(secretKeyString, password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);
        
        const wallet = new WalletModel({
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

    } catch (err) {
        console.error("Error creating wallet:", err);
        res.status(500).json({ message: "Error creating wallet" });
    }
};
export const verifyAndActivateWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, mnemonic, password } = req.body;

        console.log("🔍 Searching for wallet with userId:", userId);
    
        const wallet = await WalletModel.findOne({ userId });
        
        if (!wallet) {
            console.log("❌ No wallet found for userId:", userId);
            return res.status(404).json({ 
                message: 'Wallet not found. Please create a wallet first.' 
            });
        }

        console.log("✅ Found wallet:", {
            userId: wallet.userId,
            address: wallet.address,
            isActive: wallet.isActive 
        });
        if (wallet.isActive === true) {
            console.log("ℹ️ Wallet is already active");
            return res.status(400).json({ 
                message: 'Wallet is already activated.' 
            });
        }

        console.log("🔐 Verifying mnemonic...");
        const keypairFromMnemonic = Ed25519Keypair.deriveKeypair(mnemonic);
        const derivedAddress = keypairFromMnemonic.getPublicKey().toSuiAddress();
        
        console.log("📬 Derived address from mnemonic:", derivedAddress);
        console.log("🏦 Stored wallet address:", wallet.address);
        
        if (derivedAddress !== wallet.address) {
            console.log("❌ Mnemonic verification failed - addresses don't match");
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

    } catch (err) {
        console.error("💥 Error activating wallet:", err);
        res.status(500).json({ message: "Error activating wallet: " + (err instanceof Error ? err.message : String(err)) });
    }
};

export const importWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, mnemonic, password } = req.body;

        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        
        const existingWallet = await WalletModel.findOne({ userId });
        if (existingWallet) {
            return res.status(400).json({ 
                message: 'Wallet already exists for this user.' 
            });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(keypair.getSecretKey(), password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);

        const wallet = new WalletModel({
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

    } catch (err) {
        console.error("Error importing wallet:", err);
        res.status(500).json({ message: "Error importing wallet. Invalid mnemonic?" });
    }
};

export const getBalance = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const wallet = await WalletModel.findOne({ userId, isActive: true });
        
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
    } catch (error) {
        console.error('Balance fetch failed:', error);
        return res.status(500).json({ message: 'Error fetching balance' });
    }
};

export const transferTokens = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const { recipient, amount, password } = req.body;

        const wallet = await WalletModel.findOne({ userId, isActive: true });
        if (!wallet) {
            return res.status(404).json({ 
                message: "Wallet not found or not activated. Please verify your mnemonic first." 
            });
        }

        try {
            const privateKeyString = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
            
            console.log("Decrypted private key string:", privateKeyString);
            console.log("Decrypted key type:", typeof privateKeyString);
            console.log("Decrypted key length:", privateKeyString.length);
            
            const keypair = Ed25519Keypair.fromSecretKey(privateKeyString);

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
            
            const tx = new Transaction();
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

        } catch (decryptionError) {
            console.error("Decryption failed:", decryptionError);
            return res.status(401).json({ message: "Invalid password or decryption error" });
        }

    } catch (err) {
        console.error("Token transfer failed:", err);
        res.status(500).json({ message: "Error transferring tokens: " + (err instanceof Error ? err.message : String(err)) });
    }
};

export const getWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;
        
        if (!userId || !password) {
            return res.status(400).json({ message: 'Missing userId or password' });
        }

        const wallet = await WalletModel.findOne({ userId, isActive: true });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found or not activated' });
        }

        let mnemonic = null;
        if (req.query.includeMnemonic === 'true') {
            try {
                mnemonic = decrypt(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
            } catch (error) {
                return res.status(401).json({ message: 'Invalid password' });
            }
        }

        return res.status(200).json({
            address: wallet.address,
            mnemonic,
            message: 'Wallet fetched successfully',
        });
    } catch (error) {
        console.error('Wallet fetch failed:', error);
        return res.status(500).json({ message: 'Error fetching wallet' });
    }
};
export const getWalletStatus = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;

        const wallet = await WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
        }
        const isActive = (wallet as any).isActive;

        return res.status(200).json({
            address: wallet.address,
            isActive: isActive || false,
            message: 'Wallet status fetched successfully',
        });
    } catch (error) {
        console.error('Wallet status fetch failed:', error);
        return res.status(500).json({ message: 'Error fetching wallet status' });
    }
};

export const activateWalletAlternative = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, mnemonic, password } = req.body;

        const wallet = await WalletModel.findOne({ userId, isActive: false });
        if (!wallet) {
            return res.status(404).json({ 
                message: 'Wallet not found or already activated.' 
            });
        }
        
        const keypairFromMnemonic = Ed25519Keypair.deriveKeypair(mnemonic);
        const derivedAddress = keypairFromMnemonic.getPublicKey().toSuiAddress();
        
        if (derivedAddress !== wallet.address) {
            return res.status(400).json({ 
                message: 'Invalid mnemonic.' 
            });
        }
        await WalletModel.updateOne(
            { _id: wallet._id }, 
            { $set: { isActive: true } }
        );

        res.json({
            message: 'Wallet activated successfully!',
            address: wallet.address,
            activated: true
        });

    } catch (err) {
        console.error("Error activating wallet:", err);
        res.status(500).json({ message: "Error activating wallet" });
    }
};


export const migrateWallets = async () => {
    try {
        const result = await WalletModel.updateMany(
            { isActive: { $exists: false } },
            { $set: { isActive: false } }
        );
        console.log(`✅ Migrated ${result.modifiedCount} wallets to include isActive field`);
    } catch (error) {
        console.error('❌ Wallet migration failed:', error);
    }
};




export const exportToSuiCLI = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password } = req.body;
        
        const wallet = await WalletModel.findOne({ userId, isActive: true });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
        }

        const mnemonic = decrypt(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
        
        res.json({
            message: 'Use this mnemonic to import into Sui CLI:',
            mnemonic: mnemonic,
            suiCLICommand: `sui keytool import "${mnemonic}" ed25519`
        });
    } catch (error) {
        console.error('Export failed:', error);
        res.status(500).json({ message: 'Error exporting wallet' });
    }
};