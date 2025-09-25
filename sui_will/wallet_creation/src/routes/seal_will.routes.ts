
import { Router } from 'express';
import { 
  createWillWithDetails, 
  getWillDetails, 
  executeWillWithNote 
} from '../controllers/seal_will.controller';

const router = Router();
router.post('/create-with-details', createWillWithDetails);
router.get('/details/:ownerAddress/:willIndex', getWillDetails);
router.post('/execute-with-note/:willIndex/:ownerAddress', executeWillWithNote);

export default router;