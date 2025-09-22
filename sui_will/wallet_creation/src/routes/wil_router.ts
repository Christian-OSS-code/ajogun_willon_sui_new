// import { Router } from 'express';
// import { 
//     createWill, 
//     initiateWillExecution, 
//     executeWill, 
//     revokeWill, 
//     updateActivity, 
//     executeWillAutomatically, 
//     checkWillReadyForExecution, 
//     getAllWills, 
//     getMonitoredWills 
// } from '../controllers/will.controller';
// import { automationRelayer } from '../server/automationRelayer'; 

// const router = Router();

// router.post('/create', createWill);
// router.post('/initiate/:willIndex/:ownerAddress', initiateWillExecution);
// router.post('/execute/:willIndex/:ownerAddress', executeWill);
// router.post('/revoke/:willIndex', revokeWill);
// router.post('/update-activity/:willIndex', updateActivity); 
// router.post('/execute-automatically/:ownerAddress/:willIndex', executeWillAutomatically);
// router.get('/check-ready/:ownerAddress/:willIndex', checkWillReadyForExecution);
// router.get('/all/:ownerAddress', getAllWills); 
// router.get('/admin/monitored-wills', getMonitoredWills);
// router.post('/admin/register-will/:ownerAddress/:willIndex', (req, res) => {
//     try {
//         const { ownerAddress, willIndex } = req.params;
        
//         const index = parseInt(willIndex, 10);
//         if (isNaN(index)) {
//             return res.status(400).json({ message: "Invalid will index" });
//         }

//         automationRelayer.registerWill(ownerAddress, index);
//         res.json({ 
//             message: 'Will registered for monitoring',
//             owner: ownerAddress,
//             index: index
//         });
//     } catch (error) {
//         console.error("Error registering will:", error);
//         res.status(500).json({
//             message: "Error registering will: " + (error instanceof Error ? error.message : String(error))
//         });
//     }
// });

// export default router;





import { Router } from 'express';
import { 
    createWill, 
    initiateWillExecution, 
    executeWill, 
    revokeWill, 
    checkWillReadyForExecution, 
    updateActivity, 
    executeWillAutomatically, 
    getMonitoredWills, 
    getAllWills 
} from '../controllers/will.controller';

const router = Router();

// Route to create a new will
router.post('/create', createWill);

// Route to update a user's activity
router.post('/update-activity/:willIndex', updateActivity);

// Route for an heir to initiate will execution
router.post('/initiate/:willIndex/:ownerAddress', initiateWillExecution);

// Route for an heir to execute a will and transfer tokens
router.post('/execute/:willIndex/:ownerAddress', executeWill);

// Route for the automated relayer to execute a will
router.post('/execute-automatically/:willIndex/:ownerAddress', executeWillAutomatically);

// Route for the owner to revoke a will
router.post('/revoke/:willIndex', revokeWill);

// Route for the automated relayer to check if a will is ready
router.get('/check-ready/:willIndex/:ownerAddress', checkWillReadyForExecution);

// Route to get a list of all monitored wills
router.get('/monitored-wills', getMonitoredWills);

// Route to get all wills for a specific owner
router.get('/all/:ownerAddress', getAllWills);

export default router;
