import {Router} from 'express';
import {creatWill} from '../controllers/will.controller';

const router = Router();

router.post('create', creatWill);

export default router;


