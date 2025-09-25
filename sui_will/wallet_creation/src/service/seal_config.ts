import * as dotenv from 'dotenv';
dotenv.config();

export interface WillDetails {
  personalMessage?: string;
  assetDescriptions?: string[];
  instructions?: string;
  contactInfo?: string;
  createdAt: Date;
}

export interface EncryptedWillData {
  storageId: string;
  encryptedContent: string;
  ownerAddress: string;
  willIndex: number;
  encryptionId?: string; 
}

export const sealConfig = {

  apiBaseUrl: process.env.SEAL_API_BASE_URL || 'https://backend.seal.run/api',

  walrusUrl: process.env.WALRUS_URL || 'https://walrus.mystenlabs.com',
  
  timeout: parseInt(process.env.SEAL_API_TIMEOUT || '30000')
};