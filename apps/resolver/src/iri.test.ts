import {createN2TIriFromIri} from './iri.js';
import {describe, expect, it} from 'vitest';

describe('createN2TIriFromIri', () => {
  it.each([
    ['https://localhost', 'https://n2t.net/'],
    ['https://localhost/', 'https://n2t.net/'],
    ['https://localhost/ark', 'https://n2t.net/ark'],
    ['https://localhost/ark:', 'https://n2t.net/ark:'],
    ['https://localhost/ark:/', 'https://n2t.net/ark:/'],
    ['https://localhost/ark:/1234', 'https://n2t.net/ark:/1234'],
    ['https://localhost/ark:/1234/', 'https://n2t.net/ark:/1234/'],
    ['https://localhost/ark:/1234/abc', 'https://n2t.net/ark:/1234/abc'],
    [
      'https://localhost/ark:/1234/abc/def',
      'https://n2t.net/ark:/1234/abc/def',
    ],
    [
      'https://localhost/ark:/1234/abc/def?x=y',
      'https://n2t.net/ark:/1234/abc/def?x=y',
    ],
    [
      'https://localhost/ark:/1234/abc/def?x=y#z',
      'https://n2t.net/ark:/1234/abc/def?x=y#z',
    ],
  ])('from %s to %s', async (iri, expected) => {
    const n2tIri = createN2TIriFromIri(iri);

    expect(n2tIri).toEqual(expected);
  });
});
