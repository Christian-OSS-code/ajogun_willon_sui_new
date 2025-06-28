"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var wallet_controller_js_1 = require("../controllers/wallet.controller.js");
var app = express();
app.use(bodyParser.json());
// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/sui_will', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(function () {
    console.log('✅ Connected to database');
}).catch(function (err) {
    console.error('❌ Database connection error:', err);
});
// Routes
app.post('/wallet/create', wallet_controller_js_1.createWallet);
app.get('/wallet/:userId', wallet_controller_js_1.getWallet);
// Start server
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log("\uD83D\uDE80 Server running at http://localhost:".concat(PORT));
});
