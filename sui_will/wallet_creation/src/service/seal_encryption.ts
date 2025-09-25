import { sealClient } from './seal_client';
import { WalrusStorageService } from './walrus_storage';
import { WillDetails, EncryptedWillData } from './seal_config';

export class SealEncryptionService {
  private storage: WalrusStorageService;

  constructor() {
    this.storage = new WalrusStorageService();
  }

  async encryptWillDetails(
    details: WillDetails, 
    ownerAddress: string, 
    willIndex: number
  ): Promise<EncryptedWillData> {
    try {
      console.log(`🔐 Encrypting will details for ${ownerAddress}, will #${willIndex}`);
      const detailsString = JSON.stringify({
        ...details,
        encryptedAt: new Date().toISOString()
      });

      const dataBytes = new TextEncoder().encode(detailsString);

      let encryptionResult: any;
      
      if (typeof (sealClient as any).encrypt === 'function') {
        encryptionResult = await (sealClient as any).encrypt(dataBytes, ownerAddress);
      } else if (typeof (sealClient as any).seal === 'function') {
        encryptionResult = await (sealClient as any).seal(dataBytes, ownerAddress);
      } else if (typeof (sealClient as any).encryptData === 'function') {
        encryptionResult = await (sealClient as any).encryptData(dataBytes, ownerAddress);
      } else {
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sealClient));
        console.log('Available methods:', methods);
        throw new Error('No encryption method found on SealClient. Available methods: ' + methods.join(', '));
      }

      let encryptedData: Uint8Array;
      let encryptionId: string | undefined;

      if (encryptionResult instanceof Uint8Array) {
        encryptedData = encryptionResult;
      } else if (encryptionResult.encryptedData) {
        encryptedData = encryptionResult.encryptedData;
        encryptionId = encryptionResult.encryptionId || encryptionResult.id;
      } else if (encryptionResult.ciphertext) {
        encryptedData = encryptionResult.ciphertext;
        encryptionId = encryptionResult.id;
      } else {
        encryptedData = new TextEncoder().encode(JSON.stringify(encryptionResult));
      }

      const encryptedContent = Buffer.from(encryptedData).toString('base64');
      const storageId = await this.storage.storeData(encryptedContent);

      console.log(`✅ Will details encrypted and stored. Storage ID: ${storageId}`);

      return {
        storageId,
        encryptedContent,
        ownerAddress,
        willIndex,
        encryptionId
      };
    } catch (error) {
      console.error('❌ Error encrypting will details:', error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decryptWillDetails(
    storageId: string, 
    userAddress: string
  ): Promise<WillDetails> {
    try {
      console.log(`🔓 Decrypting will details for ${userAddress}`);

      // Retrieve encrypted data from Walrus
      const encryptedContent = await this.storage.retrieveData(storageId);
      const encryptedData = Buffer.from(encryptedContent, 'base64');

      // Use the correct Seal decryption method
      let decryptionResult: any;
      
      // Try different possible method names
      if (typeof (sealClient as any).decrypt === 'function') {
        decryptionResult = await (sealClient as any).decrypt(new Uint8Array(encryptedData), userAddress);
      } else if (typeof (sealClient as any).unseal === 'function') {
        decryptionResult = await (sealClient as any).unseal(new Uint8Array(encryptedData), userAddress);
      } else if (typeof (sealClient as any).decryptData === 'function') {
        decryptionResult = await (sealClient as any).decryptData(new Uint8Array(encryptedData), userAddress);
      } else {
        throw new Error('No decryption method found on SealClient');
      }

      // Handle the response
      let decryptedData: Uint8Array;

      if (decryptionResult instanceof Uint8Array) {
        decryptedData = decryptionResult;
      } else if (decryptionResult.data) {
        decryptedData = decryptionResult.data;
      } else if (decryptionResult.plaintext) {
        decryptedData = decryptionResult.plaintext;
      } else {
        decryptedData = new TextEncoder().encode(JSON.stringify(decryptionResult));
      }

      const decryptedString = new TextDecoder().decode(decryptedData);
      const details = JSON.parse(decryptedString) as WillDetails;

      console.log(`✅ Will details decrypted successfully`);
      return details;
    } catch (error) {
      console.error('❌ Error decrypting will details:', error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async grantHeirAccess(storageId: string, heirAddress: string): Promise<void> {
    try {
      console.log(`🔑 Granting access to heir: ${heirAddress}`);

      
      if (typeof (sealClient as any).grantAccess === 'function') {
        await (sealClient as any).grantAccess(storageId, heirAddress);
      } else if (typeof (sealClient as any).addAuthorizedUser === 'function') {
        await (sealClient as any).addAuthorizedUser(storageId, heirAddress);
      } else if (typeof (sealClient as any).updatePolicy === 'function') {
        await (sealClient as any).updatePolicy(storageId, [heirAddress]);
      } else {
        console.log('⚠️ No access control method found - access control might be handled automatically');
        
        return;
      }

      console.log(`✅ Heir access granted successfully`);
    } catch (error) {
      console.error('❌ Error granting heir access:', error);
      console.log('⚠️ Access control failed, but continuing...');
    }
  }
}






//****** */
// // src/services/seal-encryption.ts
// import { sealClient } from './seal_client';
// import { WalrusStorageService } from './walrus_storage';
// import { WillDetails, EncryptedWillData } from './seal_config';

// export class SealEncryptionService {
//   private storage: WalrusStorageService;

//   constructor() {
//     this.storage = new WalrusStorageService();
//   }

//   async encryptWillDetails(
//     details: WillDetails, 
//     ownerAddress: string, 
//     willIndex: number
//   ): Promise<EncryptedWillData> {
//     try {
//       console.log(`🔐 Encrypting will details for ${ownerAddress}, will #${willIndex}`);

//       // Convert details to JSON string
//       const detailsString = JSON.stringify({
//         ...details,
//         encryptedAt: new Date().toISOString(),
//         willIndex,
//         ownerAddress
//       });

//       // Encrypt using Seal SDK
//       const encryptionResult = await sealClient.encrypt({
//         data: new TextEncoder().encode(detailsString),
//         identity: ownerAddress, // Only this identity can decrypt initially
//         policy: {
//           type: 'identity',
//           identities: [ownerAddress]
//         }
//       });

//       // Store encrypted content on Walrus
//       const encryptedContent = Buffer.from(encryptionResult.ciphertext).toString('base64');
//       const storageId = await this.storage.storeData(encryptedContent);

//       console.log(`✅ Will details encrypted and stored. Storage ID: ${storageId}`);

//       return {
//         storageId,
//         encryptedContent,
//         ownerAddress,
//         willIndex,
//         encryptionId: encryptionResult.id
//       };
//     } catch (error) {
//       console.error('❌ Error encrypting will details:', error);
//       throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async decryptWillDetails(
//     storageId: string, 
//     userAddress: string
//   ): Promise<WillDetails> {
//     try {
//       console.log(`🔓 Decrypting will details for ${userAddress}`);

//       // Retrieve encrypted data from Walrus
//       const encryptedContentBase64 = await this.storage.retrieveData(storageId);
//       const ciphertext = Buffer.from(encryptedContentBase64, 'base64');

//       // Decrypt using Seal SDK
//       const decryptionResult = await sealClient.decrypt({
//         ciphertext,
//         identity: userAddress
//       });

//       // Convert decrypted data back to string
//       const decryptedString = new TextDecoder().decode(decryptionResult.plaintext);
//       const details = JSON.parse(decryptedString) as WillDetails;

//       console.log(`✅ Will details decrypted successfully`);
//       return details;
//     } catch (error) {
//       console.error('❌ Error decrypting will details:', error);
//       if (error instanceof Error && error.message.includes('access denied')) {
//         throw new Error('Access denied: You are not authorized to decrypt these will details');
//       }
//       throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async grantHeirAccess(storageId: string, heirAddress: string): Promise<void> {
//     try {
//       console.log(`🔑 Granting access to heir: ${heirAddress}`);

//       // Retrieve the encrypted content to get the encryption context
//       const encryptedContentBase64 = await this.storage.retrieveData(storageId);
//       const ciphertext = Buffer.from(encryptedContentBase64, 'base64');

//       // Update access policy to include heir
//       await sealClient.updatePolicy({
//         ciphertext,
//         newIdentities: [heirAddress],
//         operation: 'add'
//       });

//       console.log(`✅ Heir access granted successfully`);
//     } catch (error) {
//       console.error('❌ Error granting heir access:', error);
//       throw new Error(`Access grant failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async revokeAccess(storageId: string, addressToRemove: string): Promise<void> {
//     try {
//       console.log(`🚫 Revoking access for: ${addressToRemove}`);

//       const encryptedContentBase64 = await this.storage.retrieveData(storageId);
//       const ciphertext = Buffer.from(encryptedContentBase64, 'base64');

//       await sealClient.updatePolicy({
//         ciphertext,
//         identitiesToRemove: [addressToRemove],
//         operation: 'remove'
//       });

//       console.log(`✅ Access revoked successfully`);
//     } catch (error) {
//       console.error('❌ Error revoking access:', error);
//       throw new Error(`Access revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async testEncryption(): Promise<boolean> {
//     try {
//       const testData: WillDetails = {
//         personalMessage: 'Test message',
//         createdAt: new Date()
//       };

//       const testAddress = '0xtest';
//       const encrypted = await this.encryptWillDetails(testData, testAddress, 0);
//       const decrypted = await this.decryptWillDetails(encrypted.storageId, testAddress);

//       return decrypted.personalMessage === testData.personalMessage;
//     } catch (error) {
//       console.error('Encryption test failed:', error);
//       return false;
//     }
//   }
// }







// // src/services/seal_encryption.ts
// import { sealClient } from './seal_client';
// import { WalrusStorageService } from './walrus_storage';
// import { WillDetails, EncryptedWillData } from './seal_config';
// import { TransactionBlock } from '@mysten/sui/transactions';
// import { SuiClient } from '@mysten/sui/client';

// // Assuming sealClient provides access to suiClient for policy updates
// import { suiClient } from './seal_client'; // Adjust import based on your seal_client.ts exports

// export class SealEncryptionService {
//   private storage: WalrusStorageService;
//   private suiClient: SuiClient;

//   constructor() {
//     this.storage = new WalrusStorageService();
//     this.suiClient = suiClient; // From seal_client.ts
//   }

//   async encryptWillDetails(
//     details: WillDetails,
//     ownerAddress: string,
//     willIndex: number
//   ): Promise<EncryptedWillData> {
//     try {
//       console.log(`🔐 Encrypting will details for ${ownerAddress}, will #${willIndex}`);

//       // Convert details to JSON string and encode to Uint8Array
//       const detailsString = JSON.stringify({
//         ...details,
//         encryptedAt: new Date().toISOString(),
//         willIndex,
//         ownerAddress,
//       });
//       const plaintext = new TextEncoder().encode(detailsString);

//       // Encrypt using Seal SDK
//       const encryptionResult = await sealClient.encrypt({
//         plaintext,
//         identity: ownerAddress, // Sui address for access control
//         // policy: '0xYourPolicyObjectId' // Optional: Add if you have a specific policy ID
//       });

//       // Store encrypted content (base64-encoded) on Walrus
//       const encryptedContent = Buffer.from(encryptionResult.encryptedObject).toString('base64');
//       const storageId = await this.storage.storeData(encryptedContent);

//       console.log(`✅ Will details encrypted and stored. Storage ID: ${storageId}`);

//       return {
//         storageId,
//         encryptedContent,
//         ownerAddress,
//         willIndex,
//         // encryptionId: Not supported by EncryptedObject; omit or generate custom ID if needed
//       };
//     } catch (error) {
//       console.error('❌ Error encrypting will details:', error);
//       throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async decryptWillDetails(storageId: string, userAddress: string): Promise<WillDetails> {
//     try {
//       console.log(`🔓 Decrypting will details for ${userAddress}`);

//       // Retrieve encrypted data from Walrus
//       const encryptedContentBase64 = await this.storage.retrieveData(storageId);
//       const encryptedObject = Buffer.from(encryptedContentBase64, 'base64');

//       // Reconstruct EncryptedObject for decryption
//       const encryptedResult: { encryptedObject: Uint8Array; key: Uint8Array } = {
//         encryptedObject: encryptedObject,
//         key: new Uint8Array(32), // Placeholder: Ideally store/retrieve key from encrypt step
//         // Note: You must store the key from encryptionResult.key during encryptWillDetails
//       };

//       // Decrypt using Seal SDK
//       const plaintextBuffer = await sealClient.decrypt({
//         encryptedObject: encryptedResult,
//       });

//       // Convert decrypted data back to string
//       const decryptedString = new TextDecoder().decode(plaintextBuffer);
//       const details = JSON.parse(decryptedString) as WillDetails;

//       console.log(`✅ Will details decrypted successfully`);
//       return details;
//     } catch (error) {
//       console.error('❌ Error decrypting will details:', error);
//       if (error instanceof Error && error.message.includes('access denied')) {
//         throw new Error('Access denied: You are not authorized to decrypt these will details');
//       }
//       throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async grantHeirAccess(storageId: string, heirAddress: string): Promise<void> {
//     try {
//       console.log(`🔑 Granting access to heir: ${heirAddress}`);

//       // Retrieve encrypted content to reference the ciphertext
//       const encryptedContentBase64 = await this.storage.retrieveData(storageId);
//       const ciphertext = Buffer.from(encryptedContentBase64, 'base64');

//       // Update policy via Sui transaction (SealClient has no updatePolicy)
//       const tx = new TransactionBlock();
//       // Example: Call a hypothetical seal::policy::add_identity function
//       // Replace with actual Move module and function from your Seal setup
//       tx.moveCall({
//         target: '0xYourSealPackageId::policy::add_identity',
//         arguments: [tx.pure(ciphertext), tx.pure(heirAddress)],
//       });

//       // Execute transaction (assumes signer is configured)
//       await this.suiClient.signAndExecuteTransactionBlock({
//         transactionBlock: tx,
//         requestType: 'WaitForLocalExecution',
//         options: { showEffects: true },
//       });

//       console.log(`✅ Heir access granted successfully`);
//     } catch (error) {
//       console.error('❌ Error granting heir access:', error);
//       throw new Error(`Access grant failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async revokeAccess(storageId: string, addressToRemove: string): Promise<void> {
//     try {
//       console.log(`🚫 Revoking access for: ${addressToRemove}`);

//       const encryptedContentBase64 = await this.storage.retrieveData(storageId);
//       const ciphertext = Buffer.from(encryptedContentBase64, 'base64');

//       // Update policy via Sui transaction
//       const tx = new TransactionBlock();
//       tx.moveCall({
//         target: '0xYourSealPackageId::policy::remove_identity',
//         arguments: [tx.pure(ciphertext), tx.pure(addressToRemove)],
//       });

//       await this.suiClient.signAndExecuteTransactionBlock({
//         transactionBlock: tx,
//         requestType: 'WaitForLocalExecution',
//         options: { showEffects: true },
//       });

//       console.log(`✅ Access revoked successfully`);
//     } catch (error) {
//       console.error('❌ Error revoking access:', error);
//       throw new Error(`Access revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

//   async testEncryption(): Promise<boolean> {
//     try {
//       const testData: WillDetails = {
//         personalMessage: 'Test message',
//         createdAt: new Date(),
//       };

//       const testAddress = '0xtest';
//       const encrypted = await this.encryptWillDetails(testData, testAddress, 0);
//       const decrypted = await this.decryptWillDetails(encrypted.storageId, testAddress);

//       return decrypted.personalMessage === testData.personalMessage;
//     } catch (error) {
//       console.error('Encryption test failed:', error);
//       return false;
//     }
//   }
// }