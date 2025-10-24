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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllWills = exports.getMonitoredWills = exports.revokeWill = exports.checkWillReadyForExecution = exports.executeWillAutomatically = exports.executeWill = exports.initiateWillExecution = exports.updateActivity = exports.createWill = exports.getKeyPair = void 0;
const client_1 = require("@mysten/sui/client");
const transactions_1 = require("@mysten/sui/transactions");
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const crypto_1 = require("../utils/crypto");
const wallet_model_1 = require("../models/wallet.model");
const automationRelayer_1 = require("../server/automationRelayer");
const dotenv = __importStar(require("dotenv"));
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
const client = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
const getKeyPair = async (userId, password) => {
    console.log("🔍 Searching for wallet with userId:", userId);
    console.log("🔍 Password provided:", password ? "Yes" : "No");
    const wallet = await wallet_model_1.WalletModel.findOne({ userId, isActive: true });
    if (!wallet) {
        throw new Error("User's Wallet Not Found");
    }
    const privateKeyString = (0, crypto_1.decrypt)(wallet.encryptedPrivateKey, wallet.privateKeyIv, password, wallet.salt);
    return ed25519_1.Ed25519Keypair.fromSecretKey(privateKeyString);
};
exports.getKeyPair = getKeyPair;
const createWill = async (req, res) => {
    try {
        const { userId, password, heirs, shares } = req.body;
        const amount = req.body.amount ?? 0n;
        if (!Array.isArray(heirs) || !Array.isArray(shares) || heirs.length !== shares.length || heirs.length === 0) {
            throw new Error("Heirs and shares must be non-empty arrays of the same length.");
        }
        const keyPair = await (0, exports.getKeyPair)(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();
        console.log("Creating Will for: ", address);
        const txb = new transactions_1.Transaction();
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
        let willIndex = null;
        if (result.events && result.events.length > 0) {
            const willCreatedEvent = result.events.find((event) => event.type?.includes('WillIsCreated'));
            if (willCreatedEvent && willCreatedEvent.parsedJson) {
                willIndex = Number(willCreatedEvent.parsedJson.index);
            }
        }
        if (willIndex !== null) {
            console.log(`📝 Registering will for automation: ${address}-${willIndex}`);
            automationRelayer_1.automationRelayer.registerWill(address, willIndex);
        }
        else {
            console.error('❌ Could not extract will index from transaction events. Will not be registered for automation.');
        }
        res.json({
            message: "Will Created Successfully",
            transactionDigest: result.digest,
            events: result.events,
            willIndex: willIndex
        });
    }
    catch (error) {
        console.log("Encountered Error Creating Will: " + error);
        res.status(500).json({
            message: "Error Creating Will" + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.createWill = createWill;
const updateActivity = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const { willIndex } = req.params;
        const keyPair = await (0, exports.getKeyPair)(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();
        const txb = new transactions_1.Transaction();
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
    }
    catch (error) {
        console.log("Encountered Error Updating Activity: " + error);
        res.status(500).json({
            message: "Error Updating Activity" + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.updateActivity = updateActivity;
const initiateWillExecution = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const { willIndex, ownerAddress } = req.params;
        const keypair = await (0, exports.getKeyPair)(userId, password);
        const txb = new transactions_1.Transaction();
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
    }
    catch (error) {
        console.error("Encountered an Error Initiating Will Execution", error);
        res.status(500).json({
            message: "Encountered an Error Initiating Will Execution: " + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.initiateWillExecution = initiateWillExecution;
const executeWill = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const { willIndex, ownerAddress } = req.params;
        const keypair = await (0, exports.getKeyPair)(userId, password);
        const address = keypair.getPublicKey().toSuiAddress();
        const txb = new transactions_1.Transaction();
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
    }
    catch (error) {
        console.error("Error Executing Will: ", error);
        res.status(500).json({
            message: "Error Executing Will: " + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.executeWill = executeWill;
const executeWillAutomatically = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const { willIndex, ownerAddress } = req.params;
        let keypair;
        if (userId && password) {
            keypair = await (0, exports.getKeyPair)(userId, password);
        }
        else {
            const servicePrivateKey = process.env.AUTOMATION_SERVICE_PRIVATE_KEY;
            if (!servicePrivateKey) {
                throw new Error("Automation service private key not configured");
            }
            keypair = ed25519_1.Ed25519Keypair.fromSecretKey(servicePrivateKey);
        }
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
    }
    catch (error) {
        console.error("Error Automatically Executing Will: ", error);
        res.status(500).json({
            message: "Error Automatically Executing Will: " + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.executeWillAutomatically = executeWillAutomatically;
const checkWillReadyForExecution = async (req, res) => {
    try {
        const { ownerAddress, willIndex } = req.params;
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
            sender: DEFAULT_VIEW_CALL_SENDER,
        });
        console.log("Full dev inspect result:", JSON.stringify(result, null, 2));
        if (result.events && result.events.length > 0) {
            const willReadyEvent = result.events.find((event) => event.type?.includes('WillReadyEvent'));
            if (willReadyEvent && willReadyEvent.parsedJson) {
                const eventData = willReadyEvent.parsedJson;
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
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("Error Checking Will Status: ", error);
            res.status(500).json({
                message: "Error Checking Will Status: " + error.message
            });
        }
        else {
            console.error("Error Checking Will Status: ", error);
            res.status(500).json({
                message: "Error Checking Will Status: Unknown error occurred"
            });
        }
    }
};
exports.checkWillReadyForExecution = checkWillReadyForExecution;
const revokeWill = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const { willIndex } = req.params;
        const keyPair = await (0, exports.getKeyPair)(userId, password);
        const address = keyPair.getPublicKey().toSuiAddress();
        const txb = new transactions_1.Transaction();
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
    catch (error) {
        console.log("Encountered Error Revoking Will: " + error);
        res.status(500).json({
            message: "Error Revoking Will" + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.revokeWill = revokeWill;
const getMonitoredWills = async (req, res) => {
    try {
        const wills = automationRelayer_1.automationRelayer.getMonitoredWills();
        res.json({
            wills,
            message: "Monitored wills retrieved successfully"
        });
    }
    catch (error) {
        console.error("Error getting monitored wills:", error);
        res.status(500).json({
            message: "Error getting monitored wills: " + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.getMonitoredWills = getMonitoredWills;
const getAllWills = async (req, res) => {
    try {
        const { ownerAddress } = req.params;
        const txb = new transactions_1.Transaction();
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
            const returnValues = result.effects.returnValues || [];
            res.json({
                wills: returnValues,
                message: "Wills retrieved successfully"
            });
        }
        else {
            const error = result.effects?.status.error || 'Unknown error occurred';
            res.status(400).json({
                message: "Error retrieving wills: " + error
            });
        }
    }
    catch (error) {
        console.error("Error Retrieving Wills: ", error);
        res.status(500).json({
            message: "Error Retrieving Wills: " + (error instanceof Error ? error.message : String(error))
        });
    }
};
exports.getAllWills = getAllWills;
