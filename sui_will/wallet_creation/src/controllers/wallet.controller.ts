
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
    const { userId, password } = req.body;
    if (!userId || !password || typeof userId !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid userId or password' });
    }

    const mnemonic = generateMnemonic();
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
    const address = keypair.getPublicKey().toSuiAddress();
    const privateKeyBase64 = Buffer.from(keypair.getSecretKey()).toString('base64');

    const salt = crypto.randomBytes(16).toString('hex');
    const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(privateKeyBase64, password, salt);
    const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);

    const wallet = new WalletModel({
      userId,
      address,
      encryptedPrivateKey,
      privateKeyIv,
      encryptedMnemonic,
      mnemonicIv,
      salt,
    });
    await wallet.save();

    console.log(' Wallet Created:', { userId, address });
    return res.status(201).json({
      address,
      mnemonic,
      message: 'Wallet created successfully. Save your mnemonic securely!',
    });
  } catch (error) {
    console.error('Wallet creation failed:', error);
    return res.status(500).json({ message: 'Error creating wallet' });
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
      const { userId, recipient, amount, password } = req.body;
      if (!userId || !recipient || !amount || !password) {
        return res.status(400).json({ message: 'Missing userId, recipient, amount, or password' });
      }
      if (!recipient.startsWith('0x') || recipient.length !== 66) {
        return res.status(400).json({ message: 'Invalid recipient address' });
      }
      const amountNum = parseInt(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      const wallet = await WalletModel.findOne({ userId });
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }

      const privateKeyBase64 = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
      const privateKey = Buffer.from(privateKeyBase64, 'base64');
      const keypair = Ed25519Keypair.fromSecretKey(privateKey);

      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [amountNum]);
      tx.transferObjects([coin], recipient);
      tx.setGasBudget(1000000);

      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
      });

      return res.status(200).json({
        transactionDigest: result.digest,
        message: `Transferred ${amountNum} MIST to ${recipient}`,
      });
    } catch (error) {
      console.error('Token transfer failed:', error);
      return res.status(500).json({ message: 'Error transferring tokens' });
    }
  };


