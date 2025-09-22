// import express from 'express';
// import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
// import { Transaction } from '@mysten/sui/transactions';
// import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
// import { decrypt } from '../utils/crypto';
// import { WalletModel } from '../models/wallet.model';
// import { automationRelayer } from '../server/automationRelayer';
// import * as dotenv from 'dotenv';

// dotenv.config();

// const PACKAGE_ID = '0x3c1403f6686d6f4d5bb4035a00c388c4d58b4c37669ffe91f0fb1a13bf53e9b5';
// // const WILL_STORE_OBJECT_ID = '0xce0512c720bcf75e28c69ae51fba823d0dfe9b806bb56d8f5ea10b7751d7c29e';
// const CLOCK_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';

// const WILL_STORE_OBJECT_ID='0x8c303967f79a29076af063455c582c95602b289d7abecf241d1591bda64514c8';
// const ADMIN_CAP_OBJECT_ID='0x6441b9a1cb30a0b22d9de63a88bf24980648e0eec61d01b1668303452c52abba';
// const UPGRADE_CAP_OBJECT_ID='0xf6e825636d09be318bb10dada4c0724cab432169216e94fed237407561e7ca44';


// const DEFAULT_VIEW_CALL_SENDER = process.env.DEFAULT_VIEW_CALL_SENDER || '0x262a327a3ba54040171db252979f9286ca8ca247aebafbfc5538261f2903f44a';

// const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// const getKeyPair = async (userId: string, password: string): Promise<Ed25519Keypair> => {
//     const wallet = await WalletModel.findOne({ userId });
//     if (!wallet) {
//         throw new Error("User's Wallet Not Found");
//     }
//     const privateKeyString = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
//     return Ed25519Keypair.fromSecretKey(privateKeyString);
// };
// export const createWill = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password, heirs, shares, amount } = req.body;

//         // Input validation
//         if (!Array.isArray(heirs) || !Array.isArray(shares)) {
//             throw new Error("Heirs and shares must be arrays");
//         }

//         if (heirs.length !== shares.length) {
//             throw new Error("Heirs and shares arrays must have the same length");
//         }

//         if (heirs.length === 0) {
//             throw new Error("At least one heir must be specified");
//         }

//         const keyPair = await getKeyPair(userId, password);
//         const address = keyPair.getPublicKey().toSuiAddress();

//         console.log("Creating Will for: ", address);
//         console.log("Heirs:", heirs);
//         console.log("Shares:", shares);
//         console.log("Amount:", amount);

//         const txb = new Transaction();

//         // Use the new syntax for splitCoins with pure values :cite[1]:cite[2]
//         const [coin] = txb.splitCoins(txb.gas, [amount]);

//         // Use the new txb.pure helpers for vector types :cite[1]:cite[9]
//         const serializedHeirs = txb.pure.vector('address', heirs);
//         const serializedShares = txb.pure.vector('u64', shares.map(share => BigInt(share)));

//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::create_will`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 serializedHeirs,
//                 serializedShares,
//                 coin,
//             ],
//         });

//         const result = await client.signAndExecuteTransaction({
//             signer: keyPair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });

//         interface WillCreatedEvent {
//             parsedJson?: {
//                 owner: string;
//                 index: number;
//             };
//             type?: string;
//         }

//         let willIndex: number | null = null;
        
//         if (result.events && result.events.length > 0) {
//             const willCreatedEvent = (result.events as WillCreatedEvent[]).find((event: WillCreatedEvent) => 
//                 event.type?.includes('WillIsCreated')
//             );
            
//             if (willCreatedEvent && willCreatedEvent.parsedJson) {
//                 willIndex = Number(willCreatedEvent.parsedJson.index);
//                 console.log(`Extracted will index from event: ${willIndex}`);
//             }
//         }

//         if (willIndex !== null) {
//             automationRelayer.registerWill(address, willIndex);
//             console.log(`Registered will for automation: address=${address}, index=${willIndex}`);
//         } else {
//             console.warn("Could not extract will index from transaction events. Will not be registered for automation.");
//         }

//         res.json({
//             message: "Will Created Successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//             willIndex: willIndex 
//         });

//     } catch (error) {
//         console.log("Encountered Error Creating Will: " + error);
//         res.status(500).json({
//             message: "Error Creating Will" + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };


// export const updateActivity = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex } = req.params;

//         const keyPair = await getKeyPair(userId, password);
//         const address = keyPair.getPublicKey().toSuiAddress();

//         console.log("Updating activity for will owner: ", address, "at index: ", willIndex);

//         const txb = new Transaction();

//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::update_activity`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.u64(BigInt(willIndex)),
//             ],
//         });

//         const result = await client.signAndExecuteTransaction({
//             signer: keyPair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });

//         res.json({
//             message: "Activity Updated Successfully - Timer Reset",
//             transactionDigest: result.digest,
//             events: result.events,
//         });

//     } catch (error) {
//         console.log("Encountered Error Updating Activity: " + error);
//         res.status(500).json({
//             message: "Error Updating Activity" + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const initiateWillExecution = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex, ownerAddress } = req.params;
//         const keypair = await getKeyPair(userId, password);
//         console.log("Initiating will execution for user:", ownerAddress, "at index:", willIndex);

//         const txb = new Transaction();

//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::initiate_will_execution`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//             ],
//         });

//         const result = await client.signAndExecuteTransaction({
//             signer: keypair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });

//         res.json({
//             message: "Will Execution Successfully Initiated",
//             transactionDigest: result.digest,
//             events: result.events,
//         });

//     } catch (error) {
//         console.error("Encountered an Error Initiating Will Execution", error);
//         res.status(500).json({
//             message: "Encountered an Error Initiating Will Execution: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const executeWill = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex, ownerAddress } = req.params;

//         const keypair = await getKeyPair(userId, password);
//         const address = keypair.getPublicKey().toSuiAddress();

//         console.log("Executing Will for: ", ownerAddress, "at index: ", willIndex, "by: ", address);

//         const txb = new Transaction();

//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::execute_will`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//                 txb.object(CLOCK_OBJECT_ID),
//             ],
//         });

//         const result = await client.signAndExecuteTransaction({
//             signer: keypair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });

//         res.json({
//             message: "Will executed successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//         });

//     } catch (error) {
//         console.error("Error Executing Will: ", error);
//         res.status(500).json({
//             message: "Error Executing Will: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const executeWillAutomatically = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex, ownerAddress } = req.params;

//         let keypair: Ed25519Keypair;
        
//         if (userId && password) {
//             keypair = await getKeyPair(userId, password);
//         } else {
//             const servicePrivateKey = process.env.AUTOMATION_SERVICE_PRIVATE_KEY;
//             if (!servicePrivateKey) {
//                 throw new Error("Automation service private key not configured");
//             }
//             keypair = Ed25519Keypair.fromSecretKey(servicePrivateKey);
//         }

//         console.log("Automatically executing will for: ", ownerAddress, "at index: ", willIndex);

//         const txb = new Transaction();

//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::execute_will_automatically`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//                 txb.object(CLOCK_OBJECT_ID),
//             ],
//         });

//         const result = await client.signAndExecuteTransaction({
//             signer: keypair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });

//         res.json({
//             message: "Will automatically executed successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//         });

//     } catch (error) {
//         console.error("Error Automatically Executing Will: ", error);
//         res.status(500).json({
//             message: "Error Automatically Executing Will: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };


// // export const checkWillReadyForExecution = async (req: express.Request, res: express.Response) => {
// //     try {
// //         const { ownerAddress, willIndex } = req.params;

// //         const txb = new Transaction();
// //         txb.moveCall({
// //             target: `${PACKAGE_ID}::willon_sui::is_will_ready_for_auto_execution`,
// //             arguments: [
// //                 txb.object(WILL_STORE_OBJECT_ID),
// //                 txb.pure.address(ownerAddress),
// //                 txb.pure.u64(BigInt(willIndex)),
// //                 txb.object(CLOCK_OBJECT_ID),
// //             ],
// //         });

// //         const result = await client.devInspectTransactionBlock({
// //             transactionBlock: txb,
// //             sender: DEFAULT_VIEW_CALL_SENDER,
// //         });

// //         const effects = result.effects as any;
// //         const returnValues = effects?.returnValues;

// //         if (result.effects?.status?.status === 'success') {
// //             if (returnValues && returnValues.length > 0) {
// //                 const [returnData, returnType] = returnValues[0];
                
// //                 if (returnData && returnData.length > 0) {
// //                     const isReady = returnData[0] === 1;
                    
// //                     res.json({
// //                         isReady,
// //                         message: isReady ? "Will is ready for automatic execution" : "Will is not ready for execution yet"
// //                     });
// //                     return;
// //                 }
// //             }
            
// //             res.json({ 
// //                 isReady: false, 
// //                 message: "No return values from the readiness check" 
// //             });
// //         } else {
// //             const error = result.effects?.status?.error || 'Unknown error occurred';
// //             res.status(400).json({ 
// //                 isReady: false, 
// //                 message: "Error checking will status: " + error
// //             });
// //         }

// //     } catch (error) {
// //         if (error instanceof Error) {
// //             console.error("Error Checking Will Status: ", error);
// //             res.status(500).json({
// //                 message: "Error Checking Will Status: " + error.message
// //             });
// //         } else {
// //             console.error("Error Checking Will Status: ", error);
// //             res.status(500).json({
// //                 message: "Error Checking Will Status: Unknown error occurred"
// //             });
// //         }
// //     }
// // };




// // Define the interface for WillReadyEvent
// interface WillReadyEventData {
//     is_ready: boolean;
//     owner: string;
//     index: string; // Usually comes as string from JSON
//     timestamp: string; // Usually comes as string from JSON
// }

// export const checkWillReadyForExecution = async (req: express.Request, res: express.Response) => {
//     try {
//         const { ownerAddress, willIndex } = req.params;

//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::check_will_ready`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//                 txb.object(CLOCK_OBJECT_ID),
//             ],
//         });

//         const result = await client.devInspectTransactionBlock({
//             transactionBlock: txb,
//             sender: DEFAULT_VIEW_CALL_SENDER,
//         });

//         console.log("Full dev inspect result:", JSON.stringify(result, null, 2));

//         // Check for events instead of return values
//         if (result.events && result.events.length > 0) {
//             const willReadyEvent = result.events.find((event: any) => 
//                 event.type?.includes('WillReadyEvent')
//             );
            
//             if (willReadyEvent && willReadyEvent.parsedJson) {
//                 // Type assertion to tell TypeScript the structure
//                 const eventData = willReadyEvent.parsedJson as WillReadyEventData;
//                 const isReady = Boolean(eventData.is_ready);
                
//                 res.json({
//                     isReady,
//                     message: isReady ? "Will is ready for automatic execution" : "Will is not ready for execution yet"
//                 });
//                 return;
//             }
//         }
        
//         res.json({ 
//             isReady: false, 
//             message: "No readiness event found" 
//         });

//     } catch (error) {
//         if (error instanceof Error) {
//             console.error("Error Checking Will Status: ", error);
//             res.status(500).json({
//                 message: "Error Checking Will Status: " + error.message
//             });
//         } else {
//             console.error("Error Checking Will Status: ", error);
//             res.status(500).json({
//                 message: "Error Checking Will Status: Unknown error occurred"
//             });
//         }
//     }
// };



// export const revokeWill = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex } = req.params;

//         const keyPair = await getKeyPair(userId, password);
//         const address = keyPair.getPublicKey().toSuiAddress();

//         console.log("Revoking will for: ", address, "at index: ", willIndex);

//         const txb = new Transaction();

//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::revoke_will`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.u64(BigInt(willIndex)),
//             ],
//         });

//         const result = await client.signAndExecuteTransaction({
//             signer: keyPair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });
        
//         res.json({
//             message: "Will Revoked Successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//         });
        
//     } catch (error) {
//         console.log("Encountered Error Revoking Will: " + error);
//         res.status(500).json({
//             message: "Error Revoking Will" + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const getMonitoredWills = async (req: express.Request, res: express.Response) => {
//     try {
//         const wills = automationRelayer.getMonitoredWills();
//         res.json({
//             wills,
//             message: "Monitored wills retrieved successfully"
//         });
//     } catch (error) {
//         console.error("Error getting monitored wills:", error);
//         res.status(500).json({
//             message: "Error getting monitored wills: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const getAllWills = async (req: express.Request, res: express.Response) => {
//     try {
//         const { ownerAddress } = req.params;

//         const txb = new Transaction();

//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::get_all_wills`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//             ],
//         });

//         const result = await client.devInspectTransactionBlock({
//             transactionBlock: txb,
//             sender: DEFAULT_VIEW_CALL_SENDER,
//         });

//         if (result.effects && result.effects.status.status === 'success') {
//             const returnValues = (result.effects as any).returnValues || [];
//             res.json({
//                 wills: returnValues,
//                 message: "Wills retrieved successfully"
//             });
//         } else {
//             const error = result.effects?.status.error || 'Unknown error occurred';
//             res.status(400).json({ 
//                 message: "Error retrieving wills: " + error
//             });
//         }

//     } catch (error) {
//         console.error("Error Retrieving Wills: ", error);
//         res.status(500).json({
//             message: "Error Retrieving Wills: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };









// import express from 'express';
// import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
// import { Transaction } from '@mysten/sui/transactions';
// import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
// import { decrypt } from '../utils/crypto';
// import { WalletModel } from '../models/wallet.model';
// import { automationRelayer } from '../server/automationRelayer';
// import * as dotenv from 'dotenv';

// dotenv.config();

// const PACKAGE_ID = '0x3c1403f6686d6f4d5bb4035a00c388c4d58b4c37669ffe91f0fb1a13bf53e9b5';
// const CLOCK_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';
// const WILL_STORE_OBJECT_ID='0x8c303967f79a29076af063455c582c95602b289d7abecf241d1591bda64514c8';
// const ADMIN_CAP_OBJECT_ID='0x6441b9a1cb30a0b22d9de63a88bf24980648e0eec61d01b1668303452c52abba';
// const UPGRADE_CAP_OBJECT_ID='0xf6e825636d09be318bb10dada4c0724cab432169216e94fed237407561e7ca44';

// const DEFAULT_VIEW_CALL_SENDER = process.env.DEFAULT_VIEW_CALL_SENDER || '0x262a327a3ba54040171db252979f9286ca8ca247aebafbfc5538261f2903f44a';

// const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// const getKeyPair = async (userId: string, password: string): Promise<Ed25519Keypair> => {
//     const wallet = await WalletModel.findOne({ userId });
//     if (!wallet) {
//         throw new Error("User's Wallet Not Found");
//     }
//     const privateKeyString = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
//     return Ed25519Keypair.fromSecretKey(privateKeyString);
// };

// export const createWill = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password, heirs, shares, amount } = req.body;
//         if (!Array.isArray(heirs) || !Array.isArray(shares) || heirs.length !== shares.length || heirs.length === 0) {
//             throw new Error("Heirs and shares must be non-empty arrays of the same length.");
//         }
//         const keyPair = await getKeyPair(userId, password);
//         const address = keyPair.getPublicKey().toSuiAddress();
//         console.log("Creating Will for: ", address);
//         const txb = new Transaction();
//         const [coin] = txb.splitCoins(txb.gas, [amount]);
//         const serializedHeirs = txb.pure.vector('address', heirs);
//         const serializedShares = txb.pure.vector('u64', shares.map(share => BigInt(share)));
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::create_will`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 serializedHeirs,
//                 serializedShares,
//                 coin,
//             ],
//         });
//         const result = await client.signAndExecuteTransaction({
//             signer: keyPair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });
//         let willIndex: number | null = null;
//         if (result.events && result.events.length > 0) {
//             const willCreatedEvent = (result.events as any[]).find((event: any) => 
//                 event.type?.includes('WillIsCreated')
//             );
//             if (willCreatedEvent && willCreatedEvent.parsedJson) {
//                 willIndex = Number(willCreatedEvent.parsedJson.index);
//             }
//         }
//         if (willIndex !== null) {
//             automationRelayer.registerWill(address, willIndex);
//         } else {
//             console.warn("Could not extract will index from transaction events. Will not be registered for automation.");
//         }
//         res.json({
//             message: "Will Created Successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//             willIndex: willIndex 
//         });
//     } catch (error) {
//         console.log("Encountered Error Creating Will: " + error);
//         res.status(500).json({
//             message: "Error Creating Will" + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const updateActivity = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex } = req.params;
//         const keyPair = await getKeyPair(userId, password);
//         const address = keyPair.getPublicKey().toSuiAddress();
//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::update_activity`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.u64(BigInt(willIndex)),
//             ],
//         });
//         const result = await client.signAndExecuteTransaction({
//             signer: keyPair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });
//         res.json({
//             message: "Activity Updated Successfully - Timer Reset",
//             transactionDigest: result.digest,
//             events: result.events,
//         });
//     } catch (error) {
//         console.log("Encountered Error Updating Activity: " + error);
//         res.status(500).json({
//             message: "Error Updating Activity" + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const initiateWillExecution = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex, ownerAddress } = req.params;
//         const keypair = await getKeyPair(userId, password);
//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::initiate_will_execution`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//             ],
//         });
//         const result = await client.signAndExecuteTransaction({
//             signer: keypair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });
//         res.json({
//             message: "Will Execution Successfully Initiated",
//             transactionDigest: result.digest,
//             events: result.events,
//         });
//     } catch (error) {
//         console.error("Encountered an Error Initiating Will Execution", error);
//         res.status(500).json({
//             message: "Encountered an Error Initiating Will Execution: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const executeWill = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex, ownerAddress } = req.params;
//         const keypair = await getKeyPair(userId, password);
//         const address = keypair.getPublicKey().toSuiAddress();
//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::execute_will`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//                 txb.object(CLOCK_OBJECT_ID),
//             ],
//         });
//         const result = await client.signAndExecuteTransaction({
//             signer: keypair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });
//         res.json({
//             message: "Will executed successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//         });
//     } catch (error) {
//         console.error("Error Executing Will: ", error);
//         res.status(500).json({
//             message: "Error Executing Will: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const executeWillAutomatically = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex, ownerAddress } = req.params;
//         let keypair: Ed25519Keypair;
//         if (userId && password) {
//             keypair = await getKeyPair(userId, password);
//         } else {
//             const servicePrivateKey = process.env.AUTOMATION_SERVICE_PRIVATE_KEY;
//             if (!servicePrivateKey) {
//                 throw new Error("Automation service private key not configured");
//             }
//             keypair = Ed25519Keypair.fromSecretKey(servicePrivateKey);
//         }
//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::execute_will_automatically`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//                 txb.object(CLOCK_OBJECT_ID),
//             ],
//         });
//         const result = await client.signAndExecuteTransaction({
//             signer: keypair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });
//         res.json({
//             message: "Will automatically executed successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//         });
//     } catch (error) {
//         console.error("Error Automatically Executing Will: ", error);
//         res.status(500).json({
//             message: "Error Automatically Executing Will: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// // Define the interface for WillReadyEvent
// interface WillReadyEventData {
//     is_ready: boolean;
//     owner: string;
//     index: string; // Usually comes as string from JSON
//     timestamp: string; // Usually comes as string from JSON
// }

// export const checkWillReadyForExecution = async (req: express.Request, res: express.Response) => {
//     try {
//         const { ownerAddress, willIndex } = req.params;

//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::check_will_ready`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//                 txb.object(CLOCK_OBJECT_ID),
//             ],
//         });

//         const result = await client.devInspectTransactionBlock({
//             transactionBlock: txb,
//             sender: DEFAULT_VIEW_CALL_SENDER,
//         });

//         console.log("Full dev inspect result:", JSON.stringify(result, null, 2));

//         // Check for events instead of return values
//         if (result.events && result.events.length > 0) {
//             const willReadyEvent = result.events.find((event: any) => 
//                 event.type?.includes('WillReadyEvent')
//             );
            
//             if (willReadyEvent && willReadyEvent.parsedJson) {
//                 const eventData = willReadyEvent.parsedJson as WillReadyEventData;
//                 const isReady = Boolean(eventData.is_ready);
                
//                 res.json({
//                     isReady,
//                     message: isReady ? "Will is ready for automatic execution" : "Will is not ready for execution yet"
//                 });
//                 return;
//             }
//         }
        
//         res.json({ 
//             isReady: false, 
//             message: "No readiness event found" 
//         });

//     } catch (error) {
//         if (error instanceof Error) {
//             console.error("Error Checking Will Status: ", error);
//             res.status(500).json({
//                 message: "Error Checking Will Status: " + error.message
//             });
//         } else {
//             console.error("Error Checking Will Status: ", error);
//             res.status(500).json({
//                 message: "Error Checking Will Status: Unknown error occurred"
//             });
//         }
//     }
// };

// export const revokeWill = async (req: express.Request, res: express.Response) => {
//     try {
//         const { userId, password } = req.body;
//         const { willIndex } = req.params;
//         const keyPair = await getKeyPair(userId, password);
//         const address = keyPair.getPublicKey().toSuiAddress();
//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::revoke_will`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.u64(BigInt(willIndex)),
//             ],
//         });
//         const result = await client.signAndExecuteTransaction({
//             signer: keyPair,
//             transaction: txb,
//             options: { showEvents: true, showEffects: true },
//         });
//         res.json({
//             message: "Will Revoked Successfully",
//             transactionDigest: result.digest,
//             events: result.events,
//         });
//     } catch (error) {
//         console.log("Encountered Error Revoking Will: " + error);
//         res.status(500).json({
//             message: "Error Revoking Will" + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const getMonitoredWills = async (req: express.Request, res: express.Response) => {
//     try {
//         const wills = automationRelayer.getMonitoredWills();
//         res.json({
//             wills,
//             message: "Monitored wills retrieved successfully"
//         });
//     } catch (error) {
//         console.error("Error getting monitored wills:", error);
//         res.status(500).json({
//             message: "Error getting monitored wills: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };

// export const getAllWills = async (req: express.Request, res: express.Response) => {
//     try {
//         const { ownerAddress } = req.params;
//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::get_all_wills`,
//             arguments: [
//                 txb.object(WILL_STORE_OBJECT_ID),
//                 txb.pure.address(ownerAddress),
//             ],
//         });
//         const result = await client.devInspectTransactionBlock({
//             transactionBlock: txb,
//             sender: DEFAULT_VIEW_CALL_SENDER,
//         });
//         if (result.effects && result.effects.status.status === 'success') {
//             const returnValues = (result.effects as any).returnValues || [];
//             res.json({
//                 wills: returnValues,
//                 message: "Wills retrieved successfully"
//             });
//         } else {
//             const error = result.effects?.status.error || 'Unknown error occurred';
//             res.status(400).json({
//                 message: "Error retrieving wills: " + error
//             });
//         }
//     } catch (error) {
//         console.error("Error Retrieving Wills: ", error);
//         res.status(500).json({
//             message: "Error Retrieving Wills: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// };









import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decrypt } from '../utils/crypto';
import { WalletModel } from '../models/wallet.model';
import { automationRelayer } from '../server/automationRelayer';
import * as dotenv from 'dotenv';

dotenv.config();

// const PACKAGE_ID = '0x3c1403f6686d6f4d5bb4035a00c388c4d58b4c37669ffe91f0fb1a13bf53e9b5';
// const CLOCK_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';
// const WILL_STORE_OBJECT_ID='0x8c303967f79a29076af063455c582c95602b289d7abecf241d1591bda64514c8';
// const ADMIN_CAP_OBJECT_ID='0x6441b9a1cb30a0b22d9de63a88bf24980648e0eec61d01b1668303452c52abba';
// const UPGRADE_CAP_OBJECT_ID='0xf6e825636d09be318bb10dada4c0724cab432169216e94fed237407561e7ca44';


const PACKAGE_ID='0xfd47885cc90005eb5a9ff49bee9b3b85c3961ee8fc731f0cb00b030033b7c069';
const WILL_STORE_OBJECT_ID='0x8caa86a531bbe7cbcde2e23e99c928362cea98d6e226ffee7a6e01d5c4b156c4';

const ADMIN_CAP_OBJECT_ID='0xb88b2abadb69ec6ef149c217b0ddcc64f37bc1b7bb98b0e81acff3d43abfbc2c';


const UPGRADE_CAP_OBJECT_ID='0x11ee709344cad72fabb5cf9ba0c722f5e6b3d0da063a48da71b1c830d33ae4ff';
const CLOCK_OBJECT_ID ='0x0000000000000000000000000000000000000000000000000000000000000006';


const DEFAULT_VIEW_CALL_SENDER = process.env.DEFAULT_VIEW_CALL_SENDER || '0x262a327a3ba54040171db252979f9286ca8ca247aebafbfc5538261f2903f44a';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

const getKeyPair = async (userId: string, password: string): Promise<Ed25519Keypair> => {
    const wallet = await WalletModel.findOne({ userId });
    if (!wallet) {
        throw new Error("User's Wallet Not Found");
    }
    const privateKeyString = decrypt(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
    return Ed25519Keypair.fromSecretKey(privateKeyString);
};

export const createWill = async (req: express.Request, res: express.Response) => {
    try {
        const { userId, password, heirs, shares, amount } = req.body;
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
            automationRelayer.registerWill(address, willIndex);
        } else {
            console.warn("Could not extract will index from transaction events. Will not be registered for automation.");
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

// Define the interface for WillReadyEvent
interface WillReadyEventData {
    is_ready: boolean;
    owner: string;
    index: string; // Usually comes as string from JSON
    timestamp: string; // Usually comes as string from JSON
}

// export const checkWillReadyForExecution = async (req: express.Request, res: express.Response) => {
//     try {
//         const { ownerAddress, willIndex } = req.params;

//         const txb = new Transaction();
//         txb.moveCall({
//             target: `${PACKAGE_ID}::willon_sui::check_will_ready`,
//             arguments: [
//                 txb.pure.address(ownerAddress),
//                 txb.pure.u64(BigInt(willIndex)),
//                 txb.object(CLOCK_OBJECT_ID),
//             ],
//         });

//         const result = await client.devInspectTransactionBlock({
//             transactionBlock: txb,
//             sender: DEFAULT_VIEW_CALL_SENDER,
//         });

//         console.log("Full dev inspect result:", JSON.stringify(result, null, 2));

//         // Check for events instead of return values
//         if (result.events && result.events.length > 0) {
//             const willReadyEvent = result.events.find((event: any) => 
//                 event.type?.includes('WillReadyEvent')
//             );
            
//             if (willReadyEvent && willReadyEvent.parsedJson) {
//                 const eventData = willReadyEvent.parsedJson as WillReadyEventData;
//                 const isReady = Boolean(eventData.is_ready);
                
//                 res.json({
//                     isReady,
//                     message: isReady ? "Will is ready for automatic execution" : "Will is not ready for execution yet"
//                 });
//                 return;
//             }
//         }
        
//         res.json({ 
//             isReady: false, 
//             message: "No readiness event found" 
//         });

//     } catch (error) {
//         if (error instanceof Error) {
//             console.error("Error Checking Will Status: ", error);
//             res.status(500).json({
//                 message: "Error Checking Will Status: " + error.message
//             });
//         } else {
//             console.error("Error Checking Will Status: ", error);
//             res.status(500).json({
//                 message: "Error Checking Will Status: Unknown error occurred"
//             });
//         }
//     }
// };



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

        // Check for events instead of return values
        if (result.events && result.events.length > 0) {
            const willReadyEvent = result.events.find((event: any) => 
                event.type?.includes('WillReadyEvent')
            );
            
            if (willReadyEvent && willReadyEvent.parsedJson) {
                const eventData = willReadyEvent.parsedJson as WillReadyEventData;
                const isReady = Boolean(eventData.is_ready);
                
                // Convert timestamp string to BigInt for comparison
                const currentTimestamp = BigInt(eventData.timestamp);
                const willAutoExecuteTime = currentTimestamp + BigInt(20000); // 20 seconds
                
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







