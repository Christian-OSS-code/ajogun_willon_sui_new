import express from 'express';
import {SuiClient, getFullnodeUrl} from '@mysten/sui/client';
import {Transaction} from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {decrypt} from '../utils/crypto';
import {WalletModel} from '../models/wallet.model';
import { parse } from 'path';



const PACKAGE_ID = '0x0aa86b3a3dbccc992c325bb729616faec30f03ddaf60944352ab6f198615f621';
const WILL_STORE_OBJECT_ID = '0x91aa2d66fc5b4c56ebc665c5a24616850933c43e6f3ea368d260b9353253b23e';
const ADMIN_CAP_OBJECT_ID = '0xeb491e20551757a7f500c6b0b82fb342f4eee383cf4aa66a759d2cd4011dae0a';

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
export const revokeWill = async (req: express.Request, res: express.Response) => {
    try{
        const {userId, password} = req.body;
        const {willIndex} = req.params;

        const keyPair = await getKeyPair(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();

        console.log("Revoking will for: ", address, "at index: ", willIndex);

        const txb = new Transaction();

        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::revoke_will`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                txb.pure.u64(BigInt(willIndex)),
                
            ],
        });

        const result = await client.signAndExecuteTransaction({
            signer: keyPair,
            transaction: txb,
            options: { showEvents: true, showEffects: true },
        });
        res.json({
            message: "Will Revoked Successfully",
            transactionDigest: result.digest,
            events: result.events,
        });
    }
        catch(error){
            console.log("Encountered Error Revoking Will: " + error);
            res.status(500).json({
                message: "Error Revoking Will" + (error instanceof Error ? error.message : String(error))
            });
        }

    };

    

