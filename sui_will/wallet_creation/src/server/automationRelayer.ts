import cron from 'node-cron';
import axios from 'axios';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as dotenv from 'dotenv';

dotenv.config();

const PACKAGE_ID = process.env.PACKAGE_ID || '0xfd47885cc90005eb5a9ff49bee9b3b85c3961ee8fc731f0cb00b030033b7c069';
const WILL_STORE_OBJECT_ID = process.env.WILL_STORE_OBJECT_ID || '0x8caa86a531bbe7cbcde2e23e99c928362cea98d6e226ffee7a6e01d5c4b156c4';
const CLOCK_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

if (!RELAYER_PRIVATE_KEY) {
    throw new Error('RELAYER_PRIVATE_KEY environment variable is required');
}

const client = new SuiClient({ url: getFullnodeUrl('testnet') });
const keypair = Ed25519Keypair.fromSecretKey(RELAYER_PRIVATE_KEY);
const relayerAddress = keypair.getPublicKey().toSuiAddress();

console.log(`🤖 Relayer started with address: ${relayerAddress}`);

interface WillReadyEventData {
    is_ready: boolean;
    owner: string;
    index: string;
    timestamp: string;
}

class WillAutomationRelayer {
    private activeWills: Map<string, { owner: string; index: number; lastChecked: Date }> = new Map();

    constructor() {
        this.initializeScheduler();
    }

    private initializeScheduler() {
        cron.schedule('*/15 * * * * *', async () => {
            try {
                console.log('⏰ Checking for wills ready for automatic execution...');
                await this.checkAndExecuteWills();
            } catch (error) {
                console.error('❌ Error in scheduled check:', error);
            }
        });

        console.log('✅ Relayer scheduler initialized - running every 15 seconds');
    }

    public async registerWill(owner: string, index: number) {
        const willKey = `${owner}-${index}`;
        this.activeWills.set(willKey, {
            owner,
            index,
            lastChecked: new Date()
        });
        console.log(`📝 Registered will for monitoring: ${willKey}`);
    }

    public async unregisterWill(owner: string, index: number) {
        const willKey = `${owner}-${index}`;
        this.activeWills.delete(willKey);
        console.log(`🗑️ Unregistered will from monitoring: ${willKey}`);
    }

    private async checkAndExecuteWills() {
        for (const [willKey, willInfo] of this.activeWills.entries()) {
            try {
                const isReady = await this.checkWillReady(willInfo.owner, willInfo.index);
                
                if (isReady) {
                    console.log(`🚀 Will ${willKey} is ready for execution!`);
                    await this.executeWillAutomatically(willInfo.owner, willInfo.index);
                    this.activeWills.delete(willKey);
                    console.log(`✅ Successfully executed will: ${willKey}`);
                } else {
                    willInfo.lastChecked = new Date();
                    console.log(`⏳ Will ${willKey} not ready yet`);
                }
            } catch (error) {
                console.error(`❌ Error processing will ${willKey}:`, error);
            }
        }
    }

    // private async checkWillReady(ownerAddress: string, willIndex: number): Promise<boolean> {
    //     try {
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
    //             sender: relayerAddress,
    //         });

    //         console.log(`🔍 Relayer checking will: ${ownerAddress}-${willIndex}`);
    //         console.log("Status:", result.effects?.status?.status);
    //         console.log("Events found:", result.events?.length);

    //         if (result.events && result.events.length > 0) {
    //             console.log("All event types:", result.events.map((e: any) => e.type));
                
    //             const willReadyEvent = result.events.find((event: any) => 
    //                 event.type?.includes('WillReadyEvent')
    //             );
                
    //             if (willReadyEvent && willReadyEvent.parsedJson) {
    //                 const eventData = willReadyEvent.parsedJson as WillReadyEventData;
    //                 console.log(`Will readiness: ${eventData.is_ready}`);
    //                 return eventData.is_ready;
    //             } else {
    //                 console.log("WillReadyEvent not found or has no parsedJson");
    //             }
    //         } else {
    //             console.log("No events found in transaction result");
    //         }
            
    //         return false;
    //     } catch (error) {
    //         console.error('❌ Error checking will readiness:', error);
    //         return false;
    //     }
    // }


    private async checkWillReady(ownerAddress: string, willIndex: number): Promise<boolean> {
    try {
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
            sender: relayerAddress,
        });

        // Check for events
        if (result.events && result.events.length > 0) {
            const willReadyEvent = result.events.find((event: any) => 
                event.type?.includes('WillReadyEvent')
            );
            
            if (willReadyEvent && willReadyEvent.parsedJson) {
                const eventData = willReadyEvent.parsedJson as WillReadyEventData;
                
                // Use BigInt for timestamp comparison to avoid precision issues
                const currentTimestamp = BigInt(eventData.timestamp);
                const willAutoExecuteTime = currentTimestamp + BigInt(20000); // 20 seconds
                const currentTime = BigInt(Date.now()); // Current time in milliseconds
                
                // Check if current time is past the auto-execute time
                return currentTime >= willAutoExecuteTime;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking will readiness:', error);
        return false;
    }
}

    private async executeWillAutomatically(ownerAddress: string, willIndex: number) {
        try {
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
                options: { 
                    showEvents: true, 
                    showEffects: true,
                    showObjectChanges: true 
                },
            });

            console.log(`✅ Will executed successfully. Digest: ${result.digest}`);
            return result;
        } catch (error) {
            console.error('❌ Error executing will automatically:', error);
            throw error;
        }
    }

    public getMonitoredWills() {
        return Array.from(this.activeWills.entries()).map(([key, info]) => ({
            key,
            owner: info.owner,
            index: info.index,
            lastChecked: info.lastChecked
        }));
    }
}

export const automationRelayer = new WillAutomationRelayer();