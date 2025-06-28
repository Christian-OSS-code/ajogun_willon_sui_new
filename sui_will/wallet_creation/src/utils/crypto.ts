
import * as crypto from 'crypto';
import * as bip39 from 'bip39';

export function encrypt(text: string, password: string, salt: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

export function decrypt(encrypted: string, iv: string, password: string, salt: string): string {
  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}


