import {Storer} from './storer.js';
import {mkdir, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';

const tmpDir = './tmp';

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  await mkdir(tmpDir, {recursive: true});
});

describe('writeCommunitiesToFile', () => {
  const outputFile = join(tmpDir, 'communities.nt');

  it('writes the communities to a file', async () => {
    const storer = new Storer();
    await storer.writeCommunitiesToFile({
      path: outputFile,
      communities: [
        {
          iri: 'https://example.org/1',
          id: '1',
          name: 'Example 1',
        },
      ],
    });

    // Cheap check (string comparison instead of a graph comparison) but a sufficient one
    const triples = await readFile(outputFile, 'utf-8');

    expect(triples)
      .toStrictEqual(`<https://example.org/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.cidoc-crm.org/cidoc-crm/E74_Group> .
<https://example.org/1> <http://www.cidoc-crm.org/cidoc-crm/P2_has_type> <http://vocab.getty.edu/aat/300435377> .
<https://example.org/1> <http://www.cidoc-crm.org/cidoc-crm/P1_is_identified_by> _:df_3_0 .
<https://example.org/1> <http://www.cidoc-crm.org/cidoc-crm/P1_is_identified_by> _:df_3_1 .
_:df_3_0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.cidoc-crm.org/cidoc-crm/E33_E41_Linguistic_Appellation> .
_:df_3_0 <http://www.cidoc-crm.org/cidoc-crm/P2_has_type> <http://vocab.getty.edu/aat/300404670> .
_:df_3_0 <http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content> "Example 1" .
_:df_3_1 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.cidoc-crm.org/cidoc-crm/E42_Identifier> .
_:df_3_1 <http://www.cidoc-crm.org/cidoc-crm/P2_has_type> <http://vocab.getty.edu/aat/300404621> .
_:df_3_1 <http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content> "1" .
`);
  });
});

describe('writePersonsToFile', () => {
  const outputFile = join(tmpDir, 'communities.nt');

  it('writes the persons to a file', async () => {
    const storer = new Storer();
    await storer.writePersonsToFile({
      path: outputFile,
      persons: [
        {
          iri: 'https://example.org/1',
          id: '1',
        },
      ],
    });

    // Cheap check (string comparison instead of a graph comparison) but a sufficient one
    const triples = await readFile(outputFile, 'utf-8');

    expect(triples)
      .toStrictEqual(`<https://example.org/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.cidoc-crm.org/cidoc-crm/E21_Person> .
<https://example.org/1> <http://www.cidoc-crm.org/cidoc-crm/P1_is_identified_by> _:df_3_2 .
_:df_3_2 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.cidoc-crm.org/cidoc-crm/E42_Identifier> .
_:df_3_2 <http://www.cidoc-crm.org/cidoc-crm/P2_has_type> <http://vocab.getty.edu/aat/300404621> .
_:df_3_2 <http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content> "1" .
`);
  });
});
