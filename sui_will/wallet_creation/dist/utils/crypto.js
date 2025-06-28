import * as crypto from 'crypto';
export function encrypt(text, password, salt) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32); // User specific salt
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    return { encrypted, iv: iv.toString('hex') };
}
export function decrypt(encrypted, iv, password, salt) {
    const key = crypto.scryptSync(password, salt, 32); // User specific salt
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
