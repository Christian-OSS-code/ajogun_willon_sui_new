"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
var crypto_1 = require("crypto");
var algorithm = 'aes-256-cbc';
var key = crypto_1.default.scryptSync('your-secure-password', 'salt', 32);
var iv = Buffer.alloc(16, 0);
function encrypt(text) {
    var cipher = crypto_1.default.createCipheriv(algorithm, key, iv);
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}
function decrypt(encrypted) {
    var decipher = crypto_1.default.createDecipheriv(algorithm, key, iv);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
