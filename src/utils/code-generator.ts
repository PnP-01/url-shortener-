import { randomInt } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return code;
}
