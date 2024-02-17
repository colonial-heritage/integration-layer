import {URL} from 'url';

const baseIri = 'https://n2t.net';

export function createN2TIriFromIri(iri: string) {
  const url = new URL(iri);
  const arkPath = url.pathname + url.search + url.hash;
  const arkIri = baseIri + arkPath;

  return arkIri;
}
