import {communitySchema, type Community} from './definitions.js';
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

const toFileOptionsSchema = z.object({
  path: z.string(),
  communities: z.array(communitySchema),
});

type ToFileOptions = z.infer<typeof toFileOptionsSchema>;

export class CommunityStorer {
  // Per the data model in https://github.com/colonial-heritage/data-models/blob/main/communities/rdf.md
  private add(store: RdfStore, community: Community) {
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

  private toStore(communities: Community[]) {
    const store = RdfStore.createDefault();

    for (const community of communities) {
      this.add(store, community);
    }

    return store;
  }

  async toFile(options: ToFileOptions) {
    const opts = toFileOptionsSchema.parse(options);

    const store = this.toStore(opts.communities);
    const quadStream = store.match(); // All quads
    const dataStream = serializer.serialize(quadStream, {
      contentType: 'application/n-triples',
    });
    await mkdir(dirname(opts.path), {recursive: true});
    const writeStream = createWriteStream(opts.path); // Overwrite an existing file, if any
    await pipeline(dataStream, writeStream);
  }
}
