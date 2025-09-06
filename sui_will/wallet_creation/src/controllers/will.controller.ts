import express from 'express';
import {SuiClient, getFullnodeUrl} from '@mysten/sui/client';
import {Transaction} from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {decrypt} from '../utils/crypto';
import {WalletModel} from '../models/wallet.model';



const PACKAGE_ID = '0xcf3df26d35ec4757cac34f0a6bd89b3e90eb8c5226d6d2eb21e7b6f7117707eb';
const WILL_STORE_OBJECT_ID = '0x41d81d9bbf3389b6367d073ce47e004d8acc3bb63f7557939d0378b6c17e26bf';
const ADMIN_CAP_OBJECT_ID = '0x2a6ff4ba4612613a8e9034e90161ce69ecc441494a8b45594cbd04a50546d328';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

const getKeyPair = async(userId: string, password: string): Promise<Ed25519Keypair> =>{
        const wallet = await WalletModel.findOne({userId});
        if (!wallet){
            throw new Error("Users Wallet Not Found");
        }
        const privateKeyString = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
        return Ed25519Keypair.fromSecretKey(privateKeyString);

}
export const creatWill = async(req: express.Request, res: express.Response) =>{
    try{
        const {userId, password, heirs, shares} = req.body;

        const keyPair = await getKeyPair(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();

        console.log("Creating Will for: ", address);

        const txb = new Transaction();

        
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui:create_will`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                txb.pure(heirs),
                txb.pure(shares)
            ]

        });

        const result = await client.signAndExecuteTransaction({
            signer: keyPair,
            transaction: txb,
            options: {showEvents: true, showEffects: true},
        });

        res.json({
            message: "Will Created Successfully",
            transactionDigest: result.digest,
            events: result.events,
        });


    }
    catch (error){
        console.log("Encountered Error Creating Will: " + error)
        res.status(500).json({
            message: "Error Creating Will" + (error instanceof Error ? error.message : String(error))
        });


    }
};
