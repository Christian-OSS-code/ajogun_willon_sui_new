
    import mongoose from 'mongoose';
    import dotenv from 'dotenv';
    import path from 'path';
    import { decrypt } from './crypto';
    import { WalletModel } from '../models/wallet.model';

    dotenv.config({ path: path.resolve(__dirname, '../../.env') });

    const getPrivateKey = async (userId: string, password: string) => {
        if (!process.env.MONGODB_URI) {
            throw new Error('Missing environment variable: MONGODB_URI');
        }
        await mongoose.connect(process.env.MONGODB_URI);

        const wallet = await WalletModel.findOne({ userId });
        if (!wallet) {
            throw new Error("Wallet not found. Please ensure you have created this wallet and the database is accessible.");
        }
        const privateKey = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
        console.log("Your Private Key (DO NOT SHARE):", privateKey);
        
        await mongoose.disconnect();
    };

    const [node, script, userId, password] = process.argv;
    if (!userId || !password) {
        console.error("Usage: ts-node src/utils/get_private_key.ts <userId> <password>");
        process.exit(1);
    }

    getPrivateKey(userId, password);
    
