
import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encrypt, decrypt, generateMnemonic } from '../utils/crypto';
import { WalletModel } from '../models/wallet.model';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { Transaction } from '@mysten/sui/transactions';

dotenv.config();

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

export const createWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { password, userId } = req.body;

        const keypair = new Ed25519Keypair();
        const publicKey = keypair.getPublicKey().toSuiAddress();
        
      
        const secretKeyString = keypair.getSecretKey();
        
        console.log("Secret key string:", secretKeyString);
        console.log("Secret key type:", typeof secretKeyString);
        console.log("Secret key length:", secretKeyString.length);
        
        
        const privateKeyData = secretKeyString;
        
        const mnemonic = generateMnemonic();

      
        const salt = crypto.randomBytes(16).toString('hex');
        const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(privateKeyData, password, salt);
        const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);

        const wallet = new WalletModel({
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
            mnemonic,
        });

    } catch (err) {
        console.error("Error creating wallet:", err);
        res.status(500).json({ message: "Error creating wallet" });
    }

};
export const getWallet = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;
        if (!userId || !password) {
            return res.status(400).json({ message: 'Missing userId or password' });
        }

        const wallet = await WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
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
export const getBalance = async (req: express.Request, res: express.Response) => {
    try {
        const { userId } = req.params;
        const wallet = await WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
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

        console.log("Transfer Request:", { userId, recipient, amount });

        const wallet = await WalletModel.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found" });
        }

        console.log("Wallet found:", wallet.address);

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