import {getRdfFiles} from './glob.js';
import {describe, expect, it} from 'vitest';

describe('getRdfFiles', () => {
  it('returns RDF files', async () => {
    const files = await getRdfFiles('./fixtures/files');

    expect(files.length).toBe(2);
    expect(files[0].endsWith('/fixtures/files/1.ttl')).toBe(true);
    expect(files[1].endsWith('/fixtures/files/deep/2.nt')).toBe(true);
  });
});
