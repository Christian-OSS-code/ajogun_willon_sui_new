// import express from 'express';
// import { SealEncryptionService } from '../service/seal_encryption';
// import { WillDetailsRefModel } from '../models/will_details.model';
// import { WillDetails } from '../service/seal_config';
// import { getKeyPair } from './will.controller'; 

// const sealService = new SealEncryptionService();
// import { createWill } from './will.controller';

// export const createWillWithDetails = async (req: express.Request, res: express.Response) => {
//   try {
//     const { userId, password, heirs, shares, amount, willDetails } = req.body;
    
//     let willResult: any = {};
//     const mockRes = {
//       json: (data: any) => { willResult = data; },
//       status: (code: number) => mockRes
//     };
//     await createWill({ ...req, body: { userId, password, heirs, shares} } as express.Request, mockRes as any);

//     if (willDetails && willResult.willIndex !== null) {
//       const keyPair = await getKeyPair(userId, password);
//       const ownerAddress = keyPair.getPublicKey().toSuiAddress();

//       const encryptedData = await sealService.encryptWillDetails(
//         willDetails,
//         ownerAddress,
//         willResult.willIndex
//       );

//       await WillDetailsRefModel.create({
//         userId,
//         ownerAddress,
//         willIndex: willResult.willIndex,
//         storageId: encryptedData.storageId
//       });

//       res.json({
//         ...willResult,
//         privateDetails: {
//           stored: true,
//           storageId: encryptedData.storageId,
//           message: "Private will details encrypted and stored securely"
//         }
//       });
//     } else {
//       res.json(willResult);
//     }

//   } catch (error) {
//     console.error('Error creating will with details:', error);
//     res.status(500).json({
//       message: "Error creating will with private details",
//       error: error instanceof Error ? error.message : String(error)
//     });
//   }
// };


// export const getWillDetails = async (req: express.Request, res: express.Response) => {
//   try {
//     const { userId, password } = req.body;
//     const { ownerAddress, willIndex } = req.params;

//     const keyPair = await getKeyPair(userId, password);
//     const userAddress = keyPair.getPublicKey().toSuiAddress();

//     const detailsRef = await WillDetailsRefModel.findOne({
//       ownerAddress,
//       willIndex: parseInt(willIndex),
//       isActive: true
//     });

//     if (!detailsRef) {
//       return res.status(404).json({
//         message: "Will details not found or access denied"
//       });
//     }

//     const willDetails = await sealService.decryptWillDetails(detailsRef.storageId, userAddress);

//     res.json({
//       willDetails,
//       storageId: detailsRef.storageId,
//       accessedAt: new Date().toISOString()
//     });

//   } catch (error) {
//     console.error('Error retrieving will details:', error);
//     res.status(500).json({
//       message: "Error retrieving will details",
//       error: error instanceof Error ? error.message : String(error)
//     });
//   }
// };

// export const executeWillWithNote = async (req: express.Request, res: express.Response) => {
//   try {
//     const { userId, password } = req.body;
//     const { willIndex, ownerAddress } = req.params;
//     const executeResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/will/execute/${willIndex}/${ownerAddress}`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ userId, password })
//     });

//     if (!executeResponse.ok) {
//       throw new Error(`Will execution failed: ${executeResponse.statusText}`);
//     }

//     const executeResult = await executeResponse.json();

//     const keyPair = await getKeyPair(userId, password);
//     const heirAddress = keyPair.getPublicKey().toSuiAddress();

//     const detailsRef = await WillDetailsRefModel.findOne({
//       ownerAddress,
//       willIndex: parseInt(willIndex),
//       isActive: true
//     });

//     if (detailsRef) {
//       await sealService.grantHeirAccess(detailsRef.storageId, heirAddress);
//     }

//     res.json({
//       ...executeResult,
//       privateNote: {
//         delivered: !!detailsRef,
//         message: detailsRef ? "Private note access granted to heir" : "No private note found"
//       }
//     });

//   } catch (error) {
//     console.error('Error executing will with note:', error);
//     res.status(500).json({
//       message: "Error executing will with private note",
//       error: error instanceof Error ? error.message : String(error)
//     });
//   }
// };