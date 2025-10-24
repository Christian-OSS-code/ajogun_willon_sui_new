"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationRelayer = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@mysten/sui/client");
const transactions_1 = require("@mysten/sui/transactions");
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const PACKAGE_ID = process.env.PACKAGE_ID || '0xfd47885cc90005eb5a9ff49bee9b3b85c3961ee8fc731f0cb00b030033b7c069';
const WILL_STORE_OBJECT_ID = process.env.WILL_STORE_OBJECT_ID || '0x8caa86a531bbe7cbcde2e23e99c928362cea98d6e226ffee7a6e01d5c4b156c4';
const CLOCK_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
if (!RELAYER_PRIVATE_KEY) {
    throw new Error('RELAYER_PRIVATE_KEY environment variable is required');
}
const client = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(RELAYER_PRIVATE_KEY);
const relayerAddress = keypair.getPublicKey().toSuiAddress();
console.log(`🤖 Relayer started with address: ${relayerAddress}`);
class WillAutomationRelayer {
    constructor() {
        this.activeWills = new Map();
        this.initializeScheduler();
    }
    initializeScheduler() {
        node_cron_1.default.schedule('*/15 * * * * *', async () => {
            try {
                console.log('⏰ Checking for wills ready for automatic execution...');
                await this.checkAndExecuteWills();
            }
            catch (error) {
                console.error('❌ Error in scheduled check:', error);
            }
        });
        console.log('✅ Relayer scheduler initialized - running every 15 seconds');
    }
    async registerWill(owner, index) {
        const willKey = `${owner}-${index}`;
        this.activeWills.set(willKey, {
            owner,
            index,
            lastChecked: new Date()
        });
        console.log(`📝 Registered will for monitoring: ${willKey}`);
    }
    async unregisterWill(owner, index) {
        const willKey = `${owner}-${index}`;
        this.activeWills.delete(willKey);
        console.log(`🗑️ Unregistered will from monitoring: ${willKey}`);
    }
    async checkAndExecuteWills() {
        for (const [willKey, willInfo] of this.activeWills.entries()) {
            try {
                console.log(`🔍 Checking will: ${willKey}`);
                const isReady = await this.checkWillReady(willInfo.owner, willInfo.index);
                if (isReady) {
                    console.log(`🚀 Will ${willKey} is ready for execution! Attempting execution...`);
                    await this.executeWillAutomatically(willInfo.owner, willInfo.index);
                    this.activeWills.delete(willKey);
                    console.log(`✅ Successfully executed and removed will: ${willKey}`);
                }
                else {
                    willInfo.lastChecked = new Date();
                    console.log(`⏳ Will ${willKey} not ready yet. Last checked: ${willInfo.lastChecked}`);
                }
            }
            catch (error) {
                console.error(`❌ Error processing will ${willKey}:`, error);
            }
        }
    }
    async checkWillReady(ownerAddress, willIndex) {
        try {
            const txb = new transactions_1.Transaction();
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
            if (result.events && result.events.length > 0) {
                const willReadyEvent = result.events.find((event) => event.type?.includes('WillReadyEvent'));
                if (willReadyEvent && willReadyEvent.parsedJson) {
                    const eventData = willReadyEvent.parsedJson;
                    return Boolean(eventData.is_ready);
                }
            }
            return false;
        }
        catch (error) {
            console.error('Error checking will readiness:', error);
            return false;
        }
    }
    async executeWillAutomatically(ownerAddress, willIndex) {
        try {
            console.log(`🎯 Starting automatic execution for will ${ownerAddress}-${willIndex}`);
            const txb = new transactions_1.Transaction();
            txb.moveCall({
                target: `${PACKAGE_ID}::willon_sui::execute_will_automatically`,
                arguments: [
                    txb.object(WILL_STORE_OBJECT_ID),
                    txb.pure.address(ownerAddress),
                    txb.pure.u64(BigInt(willIndex)),
                    txb.object(CLOCK_OBJECT_ID),
                ],
            });
            console.log(`📤 Signing and executing transaction...`);
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
        }
        catch (error) {
            console.error('❌ Error executing will automatically:', error);
            throw error;
        }
    }
    getMonitoredWills() {
        return Array.from(this.activeWills.entries()).map(([key, info]) => ({
            key,
            owner: info.owner,
            index: info.index,
            lastChecked: info.lastChecked
        }));
    }
}
exports.automationRelayer = new WillAutomationRelayer();
