import {md5} from './md5.js';
import {describe, expect, it} from 'vitest';

describe('md5', () => {
  it('creates an MD5', () => {
    const md5OfInput = md5('test');

    expect(md5OfInput).toEqual('098f6bcd4621d373cade4e832627b4f6');
  });
});
