import {fetchCommunities} from './fetch.js';
import {storeCommunitiesAsRdfInFile} from './store.js';
import {getLogger} from '@colonial-collections/common';
import {type Community} from '@colonial-collections/community-storer';
import {finalize, updateService} from '@colonial-collections/xstate-actors';
import type {pino} from 'pino';
import {assign, createActor, setup, toPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  resourceDir: z.string(),
  triplydbInstanceUrl: z.string(),
  triplydbApiToken: z.string(),
  triplydbAccount: z.string(),
  triplydbDataset: z.string(),
  triplydbService: z.string(),
  triplydbServiceTemplatesFile: z.string().optional(),
  graphName: z.string(),
  tempDir: z.string().optional(),
});

export type Input = z.input<typeof inputSchema>;

export async function run(input: Input) {
  const opts = inputSchema.parse(input);

  /*
    High-level workflow:
    Fetch communities from data source
    If there are communities:
      Store communties in RDF file
      Sync data to data platform
    Finalize
  */

  const workflow = setup({
    types: {} as {
      input: Input;
      context: Input & {
        startTime: number;
        logger: pino.Logger;
        communities: Community[];
      };
    },
    actors: {
      fetchCommunities,
      finalize,
      storeCommunitiesAsRdfInFile,
      updateService,
    },
  }).createMachine({
    id: 'main',
    initial: 'fetchCommunities',
    context: ({input}) => ({
      ...input,
      startTime: Date.now(),
      logger: getLogger(),
      communities: [],
    }),
    states: {
      // State 1
      fetchCommunities: {
        invoke: {
          id: 'fetchCommunities',
          src: 'fetchCommunities',
          input: ({context}) => context,
          onDone: {
            target: 'evaluateCommunities',
            actions: assign({
              communities: ({event}) => event.output,
            }),
          },
        },
      },
      // State 2
      evaluateCommunities: {
        always: [
          {
            target: 'storeCommunitiesAsRdfInFile',
            guard: ({context}) => context.communities.length > 0,
          },
          {
            target: 'finalize',
          },
        ],
      },
      // State 3
      storeCommunitiesAsRdfInFile: {
        invoke: {
          id: 'storeCommunitiesAsRdfInFile',
          src: 'storeCommunitiesAsRdfInFile',
          input: ({context}) => context,
          onDone: 'updateService',
        },
      },
      // State 4
      updateService: {
        invoke: {
          id: 'updateService',
          src: 'updateService',
          input: ({context}) => context,
          onDone: '#main.finalize',
        },
      },
      // State 5
      finalize: {
        invoke: {
          id: 'finalize',
          src: 'finalize',
          input: ({context}) => context,
          onDone: 'done',
        },
      },
      done: {
        type: 'final',
      },
    },
  });

  await toPromise(createActor(workflow, {input: opts}).start());
}
