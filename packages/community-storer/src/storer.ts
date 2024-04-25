import {
  communitySchema,
  personSchema,
  type Community,
  type Person,
} from './definitions.js';
import {createWriteStream} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {DataFactory} from 'rdf-data-factory';
import rdfSerializer from 'rdf-serialize';
import {RdfStore} from 'rdf-stores';
import {z} from 'zod';

// Required to use ESM in both TypeScript and JavaScript
const serializer = rdfSerializer.default ?? rdfSerializer;

const DF = new DataFactory();

const writeCommunitiesToFileOptionsSchema = z.object({
  path: z.string(),
  communities: z.array(communitySchema),
});

export type WriteCommunitiesToFileOptions = z.infer<
  typeof writeCommunitiesToFileOptionsSchema
>;

const writePersonsToFileOptionsSchema = z.object({
  path: z.string(),
  persons: z.array(personSchema),
});

export type WritePersonsToFileOptions = z.infer<
  typeof writePersonsToFileOptionsSchema
>;

// Per the data model in https://github.com/colonial-heritage/data-models/blob/main/communities/rdf.md
export class Storer {
  private async toFile(store: RdfStore, path: string) {
    const quadStream = store.match(); // All quads
    const dataStream = serializer.serialize(quadStream, {
      contentType: 'application/n-triples',
    });
    await mkdir(dirname(path), {recursive: true});
    const writeStream = createWriteStream(path); // Overwrite an existing file, if any
    await pipeline(dataStream, writeStream);
  }

  private addCommunity(store: RdfStore, community: Community) {
    const communityNode = DF.namedNode(community.iri);

    // Type
    store.addQuad(
      DF.quad(
        communityNode,
        DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/E74_Group')
      )
    );

    // Classification
    store.addQuad(
      DF.quad(
        communityNode,
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/P2_has_type'),
        DF.namedNode('http://vocab.getty.edu/aat/300435377') // "Community"
      )
    );

    // Name
    const nameNode = DF.blankNode();

    store.addQuad(
      DF.quad(
        nameNode,
        DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        DF.namedNode(
          'http://www.cidoc-crm.org/cidoc-crm/E33_E41_Linguistic_Appellation'
        )
      )
    );

    // Classification of the name
    store.addQuad(
      DF.quad(
        nameNode,
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/P2_has_type'),
        DF.namedNode('http://vocab.getty.edu/aat/300404670') // "Name"
      )
    );

    // Actual name
    store.addQuad(
      DF.quad(
        nameNode,
        DF.namedNode(
          'http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content'
        ),
        DF.literal(community.name)
      )
    );

    store.addQuad(
      DF.quad(
        communityNode,
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/P1_is_identified_by'),
        nameNode
      )
    );

    // Data source identifier
    const dataSourceId = DF.blankNode();

    store.addQuad(
      DF.quad(
        dataSourceId,
        DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/E42_Identifier')
      )
    );

    // Classification of the identifier
    store.addQuad(
      DF.quad(
        dataSourceId,
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/P2_has_type'),
        DF.namedNode('http://vocab.getty.edu/aat/300404621') // "Repository number"
      )
    );

    // Actual identifier
    store.addQuad(
      DF.quad(
        dataSourceId,
        DF.namedNode(
          'http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content'
        ),
        DF.literal(community.id)
      )
    );

    store.addQuad(
      DF.quad(
        communityNode,
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/P1_is_identified_by'),
        dataSourceId
      )
    );
  }

  async writeCommunitiesToFile(options: WriteCommunitiesToFileOptions) {
    const opts = writeCommunitiesToFileOptionsSchema.parse(options);

    const store = RdfStore.createDefault();
    for (const community of opts.communities) {
      this.addCommunity(store, community);
    }

    return this.toFile(store, opts.path);
  }

  private addPerson(store: RdfStore, person: Person) {
    const personNode = DF.namedNode(person.iri);

    // Type
    store.addQuad(
      DF.quad(
        personNode,
        DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/E21_Person')
      )
    );

    // Data source identifier
    const dataSourceId = DF.blankNode();

    store.addQuad(
      DF.quad(
        dataSourceId,
        DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/E42_Identifier')
      )
    );

    // Classification of the identifier
    store.addQuad(
      DF.quad(
        dataSourceId,
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/P2_has_type'),
        DF.namedNode('http://vocab.getty.edu/aat/300404621') // "Repository number"
      )
    );

    // Actual identifier
    store.addQuad(
      DF.quad(
        dataSourceId,
        DF.namedNode(
          'http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content'
        ),
        DF.literal(person.id)
      )
    );

    store.addQuad(
      DF.quad(
        personNode,
        DF.namedNode('http://www.cidoc-crm.org/cidoc-crm/P1_is_identified_by'),
        dataSourceId
      )
    );
  }

  async writePersonsToFile(options: WritePersonsToFileOptions) {
    const opts = writePersonsToFileOptionsSchema.parse(options);

    const store = RdfStore.createDefault();
    for (const person of opts.persons) {
      this.addPerson(store, person);
    }

    return this.toFile(store, opts.path);
  }
}
