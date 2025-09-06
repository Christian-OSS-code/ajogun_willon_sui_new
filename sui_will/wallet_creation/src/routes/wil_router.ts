import {Router} from 'express';
import {creatWill, revokeWill} from '../controllers/will.controller';

const router = Router();

router.post('create', creatWill);
router.post('revoke/:willIndex', revokeWill);

export default router;


