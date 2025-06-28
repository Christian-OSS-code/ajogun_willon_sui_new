
import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encrypt, decrypt } from '../utils/crypto';
import { WalletModel } from '../models/wallet.model';
import * as crypto from 'crypto';
import { generateMnemonic } from 'bip39';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// Validate environment variables
const requiredEnvVars = ['PACKAGE_ID', 'WILL_STORE_ID'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing environment variable: ${envVar}`);
  }
}

// Use SuiClient for Testnet
const client = new SuiClient({ url: getFullnodeUrl('testnet') });

export const createWallet = async (req: express.Request, res: express.Response) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password || typeof userId !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid userId or password' });
    }

    // Generate mnemonic and keypair
    const mnemonic = generateMnemonic();
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
    const address = keypair.getPublicKey().toSuiAddress();
    const privateKeyBase64 = Buffer.from(keypair.getSecretKey()).toString('base64');

    // Generate a random salt for encryption
    const salt = Buffer.from(crypto.randomBytes(16)).toString('hex');

    // Encrypt private key and mnemonic with user-provided password
    const { encrypted: encryptedPrivateKey, iv: privateKeyIv } = encrypt(privateKeyBase64, password, salt);
    const { encrypted: encryptedMnemonic, iv: mnemonicIv } = encrypt(mnemonic, password, salt);

    // Save to MongoDB
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

    console.log('✅ Wallet Created:', { userId, address });
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

export const sendSui = async (req: express.Request, res: express.Response) => {
  try {
    const { userId, recipient, amount, password } = req.body;
    if (!userId || !recipient || !amount || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const wallet = await WalletModel.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    let privateKeyBase64;
    try {
      privateKeyBase64 = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const privateKey = Buffer.from(privateKeyBase64, 'base64');
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);

    // Create and sign transaction
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount * 1_000_000_000)]);
    tx.transferObjects([coin], tx.pure.address(recipient));
    const txResponse = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    return res.status(200).json({
      transactionDigest: txResponse.digest,
      message: 'Transaction executed successfully',
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    return res.status(500).json({ message: 'Error sending SUI' });
  }
};

export const executeWill = async (req: express.Request, res: express.Response) => {
  try {
    const { userId, index, password, adminCapId } = req.body;
    if (!userId || !index || !password || !adminCapId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const wallet = await WalletModel.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    let privateKeyBase64;
    try {
      privateKeyBase64 = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const privateKey = Buffer.from(privateKeyBase64, 'base64');
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);

    // Initiate will execution
    const tx = new Transaction();
    tx.moveCall({
      target: `${process.env.PACKAGE_ID}::willon_sui::initiate_will_execution`,
      arguments: [
        tx.object(adminCapId),
        tx.object(process.env.WILL_STORE_ID!),
        tx.pure.address(wallet.address),
        tx.pure.u64(index),
      ],
    });

    const initiateResult = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    // Wait 20 seconds for the delay
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Execute will
    const coinObject = await client.getCoins({ owner: wallet.address, coinType: '0x2::sui::SUI' });
    if (!coinObject.data.length) {
      return res.status(400).json({ message: 'No SUI coins available' });
    }

    const tx2 = new Transaction();
    tx2.moveCall({
      target: `${process.env.PACKAGE_ID}::willon_sui::execute_will`,
      arguments: [
        tx2.object(adminCapId),
        tx2.object(process.env.WILL_STORE_ID!),
        tx2.pure.address(wallet.address),
        tx2.pure.u64(index),
        tx2.object(coinObject.data[0].coinObjectId),
      ],
    });

    const executeResult = await client.signAndExecuteTransaction({
      transaction: tx2,
      signer: keypair,
      options: { showEffects: true },
    });

    return res.status(200).json({
      transactionDigest: executeResult.digest,
      message: 'Will execution completed',
    });
  } catch (error) {
    console.error('Will execution failed:', error);
    return res.status(500).json({ message: 'Error executing will' });
  }
};