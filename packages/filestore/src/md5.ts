import crypto from 'node:crypto';

export function md5(data: string) {
  return crypto.createHash('md5').update(data).digest('hex');
}
