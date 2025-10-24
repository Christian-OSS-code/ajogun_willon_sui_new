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
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.generateMnemonic = generateMnemonic;
const crypto = __importStar(require("crypto"));
const bip39 = __importStar(require("bip39"));
function encrypt(text, password, salt) {
    try {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(password, salt, 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return { encrypted, iv: iv.toString('hex') };
    }
    catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}
function decrypt(encrypted, iv, password, salt) {
    try {
        console.log('Decryption debug:');
        console.log('Encrypted length:', encrypted.length);
        console.log('IV:', iv);
        console.log('Password length:', password.length);
        console.log('Salt:', salt);
        const key = crypto.scryptSync(password, salt, 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        console.log('Decrypted length:', decrypted.length);
        console.log('Decrypted content (first 50 chars):', decrypted.substring(0, 50));
        return decrypted;
    }
    catch (error) {
        console.error('Decryption error:', error);
        if (error instanceof Error) {
            throw new Error('Failed to decrypt data: ' + error.message);
        }
        else {
            throw new Error('Failed to decrypt data: ' + String(error));
        }
    }
}
function generateMnemonic() {
    return bip39.generateMnemonic();
}
