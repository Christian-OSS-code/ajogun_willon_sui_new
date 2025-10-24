"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const will_controller_1 = require("../controllers/will.controller");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    res.send('✅ API is running...');
});
router.post('/create', will_controller_1.createWill);
router.post('/update-activity/:willIndex', will_controller_1.updateActivity);
router.post('/initiate/:willIndex/:ownerAddress', will_controller_1.initiateWillExecution);
router.post('/execute/:willIndex/:ownerAddress', will_controller_1.executeWill);
router.post('/execute-automatically/:ownerAddress/:willIndex', will_controller_1.executeWillAutomatically);
router.post('/revoke/:willIndex', will_controller_1.revokeWill);
router.get('/check-ready/:ownerAddress/:willIndex', will_controller_1.checkWillReadyForExecution);
router.get('/monitored-wills', will_controller_1.getMonitoredWills);
router.get('/all/:ownerAddress', will_controller_1.getAllWills);
exports.default = router;
