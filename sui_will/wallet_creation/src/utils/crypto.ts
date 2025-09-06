import * as crypto from 'crypto';
import * as bip39 from 'bip39';

export function encrypt(text: string, password: string, salt: string): { encrypted: string; iv: string } {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { encrypted, iv: iv.toString('hex') };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }



}
export function decrypt(encrypted: string, iv: string, password: string, salt: string): string {
  try {
    console.log('Decryption debug:');
    console.log('Encrypted length:', encrypted.length);
    console.log('IV:', iv);
    console.log('Password length:', password.length);
    console.log('Salt:', salt);

    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    console.log('Decrypted length:', decrypted.length);
    console.log('Decrypted content (first 50 chars):', decrypted.substring(0, 50));
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    if (error instanceof Error) {
      throw new Error('Failed to decrypt data: ' + error.message);
    } else {
      throw new Error('Failed to decrypt data: ' + String(error));
    }
  }


  
}
export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}