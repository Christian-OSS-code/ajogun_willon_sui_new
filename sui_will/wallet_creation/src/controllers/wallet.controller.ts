import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encrypt, decrypt, generateMnemonic } from '../utils/crypto';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { Transaction } from '@mysten/sui/transactions';
import { prisma } from '../lib/prisma';

dotenv.config();

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// ---------------- CREATE WALLET ----------------
export const createWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { password, userId } = req.body;
        const mnemonic = generateMnemonic(); 
        
        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        const secretKeyString = keypair.getSecretKey();

        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(secretKeyString, password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);
        
        const wallet = await prisma.wallet.create({
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

    } catch (err) {
        console.error("Error creating wallet:", err);
        res.status(500).json({ message: "Error creating wallet" });
    }
};

export const verifyAndActivateWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, mnemonic, password } = req.body;

        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found. Please create a wallet first.' });
        }

        if (wallet.isActive) {
            return res.status(400).json({ message: 'Wallet is already activated.' });
        }

        const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
        const keypairFromMnemonic = Ed25519Keypair.deriveKeypair(normalizedMnemonic);
        const derivedAddress = keypairFromMnemonic.getPublicKey().toSuiAddress();

        if (derivedAddress !== wallet.address) {
            try {
                const storedMnemonic = decrypt(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
                console.log("Stored mnemonic:", storedMnemonic);
            } catch {}
            return res.status(400).json({ message: 'Invalid mnemonic. The mnemonic does not match the wallet address.' });
        }

        await prisma.wallet.update({
            where: { userId },
            data: { isActive: true }
        });

        res.json({
            message: 'Wallet activated successfully! Your mnemonic has been verified.',
            address: wallet.address,
            activated: true
        });

    } catch (err) {
        console.error("Error activating wallet:", err);
        res.status(500).json({ message: "Error activating wallet" });
    }
};

export const importWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, mnemonic, password } = req.body;

        const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
        if (existingWallet) {
            return res.status(400).json({ message: 'Wallet already exists for this user.' });
        }

        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        const publicKey = keypair.getPublicKey().toSuiAddress();
        const salt = crypto.randomBytes(16).toString('hex');

        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(keypair.getSecretKey(), password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);

        await prisma.wallet.create({
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

    } catch (err) {
        console.error("Error importing wallet:", err);
        res.status(500).json({ message: "Error importing wallet. Invalid mnemonic?" });
    }
};
export const getBalance = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const wallet = await prisma.wallet.findFirst({ where: { userId, isActive: true } });
        
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found or not activated.' });
        }

        const balance = await client.getBalance({ owner: wallet.address });
        res.json({
            address: wallet.address,
            balance: balance.totalBalance,
            message: 'Balance fetched successfully',
        });
    } catch (err) {
        console.error("Balance fetch failed:", err);
        res.status(500).json({ message: 'Error fetching balance' });
    }
};


export const transferTokens = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const { recipient, amount, password } = req.body;

        const wallet = await prisma.wallet.findFirst({ where: { userId, isActive: true } });
        if (!wallet) return res.status(404).json({ message: "Wallet not found or not activated." });

        const privateKeyString = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
        const keypair = Ed25519Keypair.fromSecretKey(privateKeyString);

        if (keypair.getPublicKey().toSuiAddress() !== wallet.address) {
            return res.status(401).json({ message: "Key derivation error: addresses don't match" });
        }

        const balance = await client.getBalance({ owner: wallet.address });
        const amountNum = parseInt(amount);

        if (parseInt(balance.totalBalance) < amountNum) {
            return res.status(400).json({ message: `Insufficient balance. Available: ${balance.totalBalance}, Required: ${amountNum}` });
        }

        const tx = new Transaction();
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

    } catch (err) {
        console.error("Token transfer failed:", err);
        res.status(500).json({ message: "Error transferring tokens" });
    }
};

export const getWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;
        if (!userId || !password) return res.status(400).json({ message: 'Missing userId or password' });

        const wallet = await prisma.wallet.findFirst({ where: { userId, isActive: true } });
        if (!wallet) return res.status(404).json({ message: 'Wallet not found or not activated' });

        let mnemonic: string | null = null;
        if (req.query.includeMnemonic === 'true') {
            mnemonic = decrypt(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);
        }

        res.json({
            address: wallet.address,
            mnemonic,
            message: 'Wallet fetched successfully',
        });
    } catch (err) {
        console.error("Wallet fetch failed:", err);
        res.status(500).json({ message: 'Error fetching wallet' });
    }
};

export const getWalletStatus = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

        res.json({
            address: wallet.address,
            isActive: wallet.isActive || false,
            message: 'Wallet status fetched successfully',
        });
    } catch (err) {
        console.error("Wallet status fetch failed:", err);
        res.status(500).json({ message: 'Error fetching wallet status' });
    }
};

export const activateWalletAlternative = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, mnemonic } = req.body;

        const wallet = await prisma.wallet.findFirst({ where: { userId, isActive: false } });
        if (!wallet) return res.status(404).json({ message: 'Wallet not found or already activated.' });

        const keypairFromMnemonic = Ed25519Keypair.deriveKeypair(mnemonic);
        if (keypairFromMnemonic.getPublicKey().toSuiAddress() !== wallet.address) {
            return res.status(400).json({ message: 'Invalid mnemonic.' });
        }

        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { isActive: true }
        });

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
        await prisma.wallet.updateMany({
            where: {}, 
            data: { isActive: false }
        });
        console.log("✅ Wallet migration completed");
    } catch (err) {
        console.error("❌ Wallet migration failed:", err);
    }
};


export const exportToSuiCLI = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password } = req.body;
        const wallet = await prisma.wallet.findFirst({ where: { userId, isActive: true } });
        if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

        const mnemonic = decrypt(wallet.encryptedMnemonic, wallet.mnemonicIv, password, wallet.salt);

        res.json({
            message: 'Use this mnemonic to import into Sui CLI:',
            mnemonic,
            suiCLICommand: `sui keytool import "${mnemonic}" ed25519`
        });
    } catch (err) {
        console.error("Export failed:", err);
        res.status(500).json({ message: 'Error exporting wallet' });
    }
};
