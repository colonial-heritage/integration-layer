import {toChunks} from './array-to-chunks.js';
import {describe, expect, it} from 'vitest';

describe('toChunks', () => {
  it('splits an array into chunks', () => {
    const chunks = [...toChunks([1, 2], 1)];

    expect(chunks).toStrictEqual([[1], [2]]);
  });

  it('splits an array into chunks', () => {
    const chunks = [...toChunks([1, 2, 3], 2)];

    expect(chunks).toStrictEqual([[1, 2], [3]]);
  });
});
