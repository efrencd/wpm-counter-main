import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export async function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
