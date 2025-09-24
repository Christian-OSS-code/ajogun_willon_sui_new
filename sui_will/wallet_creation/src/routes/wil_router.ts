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
    getAllWills,
} from '../controllers/will.controller';

const router = Router();
router.get('/', (req, res) => {
  res.send('✅ API is running...');
});
router.post('/create', createWill);
router.post('/update-activity/:willIndex', updateActivity);
router.post('/initiate/:willIndex/:ownerAddress', initiateWillExecution);
router.post('/execute/:willIndex/:ownerAddress', executeWill);
router.post('/execute-automatically/:ownerAddress/:willIndex', executeWillAutomatically);
router.post('/revoke/:willIndex', revokeWill);
router.get('/check-ready/:ownerAddress/:willIndex', checkWillReadyForExecution);
router.get('/monitored-wills', getMonitoredWills);
router.get('/all/:ownerAddress', getAllWills);


export default router;
