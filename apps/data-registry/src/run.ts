import {collectRdfFiles, FileAndGraph} from './collect.js';
import {uploadRdfFiles} from './upload.js';
import {getLogger} from '@colonial-collections/common';
import {finalize} from '@colonial-collections/xstate-actors';
import type {pino} from 'pino';
import {assign, createActor, setup, toPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  globPattern: z.string(),
  graphBaseIri: z.string(),
  triplydbInstanceUrl: z.string(),
  triplydbApiToken: z.string(),
  triplydbAccount: z.string(),
  triplydbDataset: z.string(),
});

export type Input = z.input<typeof inputSchema>;

export async function run(input: Input) {
  const opts = inputSchema.parse(input);

  /*
    High-level workflow:
    Collect RDF files
    If RDF files found:
      Upload RDF files to data platform
    Finalize
  */

  const workflow = setup({
    types: {} as {
      input: Input;
      context: Input & {
        startTime: number;
        logger: pino.Logger;
        filesAndGraphs: FileAndGraph[];
      };
    },
    actors: {
      collectRdfFiles,
      finalize,
      uploadRdfFiles,
    },
  }).createMachine({
    id: 'main',
    initial: 'collectRdfFiles',
    context: ({input}) => ({
      ...input,
      startTime: Date.now(),
      logger: getLogger(),
      filesAndGraphs: [],
    }),
    states: {
      // State 1
      collectRdfFiles: {
        invoke: {
          id: 'collectRdfFiles',
          src: 'collectRdfFiles',
          input: ({context}) => context,
          onDone: {
            target: 'evaluateRdfFiles',
            actions: assign({
              filesAndGraphs: ({event}) => event.output,
            }),
          },
        },
      },
      // State 2
      evaluateRdfFiles: {
        always: [
          {
            target: 'uploadRdfFiles',
            guard: ({context}) => context.filesAndGraphs.length > 0,
          },
          {
            target: 'finalize',
          },
        ],
      },
      // State 3
      uploadRdfFiles: {
        invoke: {
          id: 'uploadRdfFiles',
          src: 'uploadRdfFiles',
          input: ({context}) => context,
          onDone: 'finalize',
        },
      },
      // State 4
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
