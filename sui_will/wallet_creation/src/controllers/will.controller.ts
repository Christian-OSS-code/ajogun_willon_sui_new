import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decrypt } from '../utils/crypto';
import { WalletModel } from '../models/wallet.model';
import { automationRelayer } from '../server/automationRelayer';
import * as dotenv from 'dotenv';

dotenv.config();


const PACKAGE_ID = process.env.PACKAGE_ID;

const WILL_STORE_OBJECT_ID = process.env.WILL_STORE_OBJECT_ID;
if (!WILL_STORE_OBJECT_ID) {
    throw new Error("WILL_STORE_OBJECT_ID environment variable is not set");
}

const ADMIN_CAP_OBJECT_ID = process.env.ADMIN_CAP_OBJECT_ID;


const UPGRADE_CAP_OBJECT_ID = process.env.UPGRADE_CAP_OBJECT_ID;

const CLOCK_OBJECT_ID = process.env.CLOCK_OBJECT_ID;
if (!CLOCK_OBJECT_ID) {
    throw new Error("CLOCK_OBJECT_ID environment variable is not set");
}

const DEFAULT_VIEW_CALL_SENDER = process.env.DEFAULT_VIEW_CALL_SENDER || '0x262a327a3ba54040171db252979f9286ca8ca247aebafbfc5538261f2903f44a';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

export const getKeyPair = async (userId: string, password: string): Promise<Ed25519Keypair> => {
    console.log("🔍 Searching for wallet with userId:", userId);
    console.log("🔍 Password provided:", password ? "Yes" : "No");

    const wallet = await WalletModel.findOne({ userId, isActive: true });
    if (!wallet) {
        throw new Error("User's Wallet Not Found");
    }
    const privateKeyString = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
    return Ed25519Keypair.fromSecretKey(privateKeyString);
};

export const createWill = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password, heirs, shares } = req.body;
        const amount = req.body.amount ?? 0n;

        if (!Array.isArray(heirs) || !Array.isArray(shares) || heirs.length !== shares.length || heirs.length === 0) {
            throw new Error("Heirs and shares must be non-empty arrays of the same length.");
        }
    
        const keyPair = await getKeyPair(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();
        
        console.log("Creating Will for: ", address);
    
        const txb = new Transaction();
        const [coin] = txb.splitCoins(txb.gas, [amount]);
        const serializedHeirs = txb.pure.vector('address', heirs);
        const serializedShares = txb.pure.vector('u64', shares.map(share => BigInt(share)));
        
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::create_will`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                serializedHeirs,
                serializedShares,
                coin,
            ],
        });

        const result = await client.signAndExecuteTransaction({
            signer: keyPair,  
            transaction: txb, 
            options: { showEvents: true, showEffects: true },
        });
        
        let willIndex: number | null = null;
        if (result.events && result.events.length > 0) {
            const willCreatedEvent = (result.events as any[]).find((event: any) => 
                event.type?.includes('WillIsCreated')
            );
            if (willCreatedEvent && willCreatedEvent.parsedJson) {
                willIndex = Number(willCreatedEvent.parsedJson.index);
            }
        }
        
        if (willIndex !== null) {
            console.log(`📝 Registering will for automation: ${address}-${willIndex}`);
            automationRelayer.registerWill(address, willIndex);
        } else {
            console.error('❌ Could not extract will index from transaction events. Will not be registered for automation.');
        }
        
        res.json({
            message: "Will Created Successfully",
            transactionDigest: result.digest,
            events: result.events,
            willIndex: willIndex 
        });
    } catch (error) {
        console.log("Encountered Error Creating Will: " + error);
        res.status(500).json({
            message: "Error Creating Will" + (error instanceof Error ? error.message : String(error))
        });
    }
};

export const updateActivity = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password } = req.body;
        const { willIndex } = req.params;
        const keyPair = await getKeyPair(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();
        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::update_activity`,
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
            message: "Activity Updated Successfully - Timer Reset",
            transactionDigest: result.digest,
            events: result.events,
        });
    } catch (error) {
        console.log("Encountered Error Updating Activity: " + error);
        res.status(500).json({
            message: "Error Updating Activity" + (error instanceof Error ? error.message : String(error))
        });
    }
};

export const initiateWillExecution = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password } = req.body;
        const { willIndex, ownerAddress } = req.params;
        const keypair = await getKeyPair(userId, password);
        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::initiate_will_execution`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                txb.pure.address(ownerAddress),
                txb.pure.u64(BigInt(willIndex)),
            ],
        });
        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: txb,
            options: { showEvents: true, showEffects: true },
        });
        res.json({
            message: "Will Execution Successfully Initiated",
            transactionDigest: result.digest,
            events: result.events,
        });
    } catch (error) {
        console.error("Encountered an Error Initiating Will Execution", error);
        res.status(500).json({
            message: "Encountered an Error Initiating Will Execution: " + (error instanceof Error ? error.message : String(error))
        });
    }
};

export const executeWill = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password } = req.body;
        const { willIndex, ownerAddress } = req.params;
        const keypair = await getKeyPair(userId, password);
        const address = keypair.getPublicKey().toSuiAddress();
        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::execute_will`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                txb.pure.address(ownerAddress),
                txb.pure.u64(BigInt(willIndex)),
                txb.object(CLOCK_OBJECT_ID),
            ],
        });
        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: txb,
            options: { showEvents: true, showEffects: true },
        });
        res.json({
            message: "Will executed successfully",
            transactionDigest: result.digest,
            events: result.events,
        });
    } catch (error) {
        console.error("Error Executing Will: ", error);
        res.status(500).json({
            message: "Error Executing Will: " + (error instanceof Error ? error.message : String(error))
        });
    }
};

export const executeWillAutomatically = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password } = req.body;
        const { willIndex, ownerAddress } = req.params;
        let keypair: Ed25519Keypair;
        if (userId && password) {
            keypair = await getKeyPair(userId, password);
        } else {
            const servicePrivateKey = process.env.AUTOMATION_SERVICE_PRIVATE_KEY;
            if (!servicePrivateKey) {
                throw new Error("Automation service private key not configured");
            }
            keypair = Ed25519Keypair.fromSecretKey(servicePrivateKey);
        }
        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::execute_will_automatically`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                txb.pure.address(ownerAddress),
                txb.pure.u64(BigInt(willIndex)),
                txb.object(CLOCK_OBJECT_ID),
            ],
        });
        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: txb,
            options: { showEvents: true, showEffects: true },
        });
        res.json({
            message: "Will automatically executed successfully",
            transactionDigest: result.digest,
            events: result.events,
        });
    } catch (error) {
        console.error("Error Automatically Executing Will: ", error);
        res.status(500).json({
            message: "Error Automatically Executing Will: " + (error instanceof Error ? error.message : String(error))
        });
    }
};

interface WillReadyEventData {
    is_ready: boolean;
    owner: string;
    index: string; 
    timestamp: string; 
}

export const checkWillReadyForExecution = async (req: express.Request, res: express.Response) => {
    try {
        const { ownerAddress, willIndex } = req.params;

        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::check_will_ready`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                txb.pure.address(ownerAddress),
                txb.pure.u64(BigInt(willIndex)),
                txb.object(CLOCK_OBJECT_ID),
            ],
        });

        const result = await client.devInspectTransactionBlock({
            transactionBlock: txb,
            sender: DEFAULT_VIEW_CALL_SENDER,
        });

        console.log("Full dev inspect result:", JSON.stringify(result, null, 2));

        if (result.events && result.events.length > 0) {
            const willReadyEvent = result.events.find((event: any) => 
                event.type?.includes('WillReadyEvent')
            );
            
            if (willReadyEvent && willReadyEvent.parsedJson) {
                const eventData = willReadyEvent.parsedJson as WillReadyEventData;
                const isReady = Boolean(eventData.is_ready);
                
                const currentTimestamp = BigInt(eventData.timestamp);
                const willAutoExecuteTime = currentTimestamp + BigInt(20000); 
                
                res.json({
                    isReady,
                    currentTimestamp: eventData.timestamp,
                    autoExecuteTime: willAutoExecuteTime.toString(),
                    message: isReady ? "Will is ready for automatic execution" : "Will is not ready for execution yet"
                });
                return;
            }
        }
        
        res.json({ 
            isReady: false, 
            message: "No readiness event found" 
        });

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error Checking Will Status: ", error);
            res.status(500).json({
                message: "Error Checking Will Status: " + error.message
            });
        } else {
            console.error("Error Checking Will Status: ", error);
            res.status(500).json({
                message: "Error Checking Will Status: Unknown error occurred"
            });
        }
    }
};
export const revokeWill = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password } = req.body;
        const { willIndex } = req.params;
        const keyPair = await getKeyPair(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();
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
    } catch (error) {
        console.log("Encountered Error Revoking Will: " + error);
        res.status(500).json({
            message: "Error Revoking Will" + (error instanceof Error ? error.message : String(error))
        });
    }
};

export const getMonitoredWills = async (req: express.Request, res: express.Response) => {
    try {
        const wills = automationRelayer.getMonitoredWills();
        res.json({
            wills,
            message: "Monitored wills retrieved successfully"
        });
    } catch (error) {
        console.error("Error getting monitored wills:", error);
        res.status(500).json({
            message: "Error getting monitored wills: " + (error instanceof Error ? error.message : String(error))
        });
    }
};

export const getAllWills = async (req: express.Request, res: express.Response) => {
    try {
        const { ownerAddress } = req.params;
        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::willon_sui::get_all_wills`,
            arguments: [
                txb.object(WILL_STORE_OBJECT_ID),
                txb.pure.address(ownerAddress),
            ],
        });
        const result = await client.devInspectTransactionBlock({
            transactionBlock: txb,
            sender: DEFAULT_VIEW_CALL_SENDER,
        });
        if (result.effects && result.effects.status.status === 'success') {
            const returnValues = (result.effects as any).returnValues || [];
            res.json({
                wills: returnValues,
                message: "Wills retrieved successfully"
            });
        } else {
            const error = result.effects?.status.error || 'Unknown error occurred';
            res.status(400).json({
                message: "Error retrieving wills: " + error
            });
        }
    } catch (error) {
        console.error("Error Retrieving Wills: ", error);
        res.status(500).json({
            message: "Error Retrieving Wills: " + (error instanceof Error ? error.message : String(error))
        });
    }
};



