import {generate} from './generate.js';
import {getLogger} from '@colonial-collections/common';
import {
  Connection,
  Queue,
  Registry,
  Runs,
} from '@colonial-collections/datastore';
import {
  finalize,
  getQueueSize,
  iterate,
  registerRun,
  registerRunAndCheckIfRunMustContinue,
  removeObsoleteResources,
  updateService,
} from '@colonial-collections/xstate-actors';
import type {pino} from 'pino';
import {assign, createActor, setup, toPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  resourceDir: z.string(),
  dataFile: z.string(),
  checkEndpointUrl: z.string().optional(),
  checkIfRunMustContinueQueryFile: z.string().optional(),
  checkIfRunMustContinueTimeout: z.number().optional(),
  iterateEndpointUrl: z.string(),
  iterateQueryFile: z.string(),
  iterateWaitBetweenRequests: z.number().default(500),
  iterateTimeoutPerRequest: z.number().optional(),
  iterateNumberOfIrisPerRequest: z.number().default(10000),
  generateEndpointUrl: z.string(),
  generateQueryFile: z.string(),
  generateWaitBetweenRequests: z.number().default(100),
  generateTimeoutPerRequest: z.number().optional(),
  generateNumberOfConcurrentRequests: z.number().default(20), // ~ single-threaded max performance
  generateBatchSize: z.number().default(50000),
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

  const connection = await Connection.new({path: opts.dataFile});
  const queue = new Queue({connection});
  const registry = new Registry({connection});
  const runs = new Runs({connection});

  /*
    High-level workflow:
    Get size of queue
    If queue is empty and a 'must run continue' query file is set: (start a new run)
      Register run
      Check if run must continue
      If run must continue:
        Collect IRIs of resources
        Remove obsolete resources
      Finalize
    Else if queue is empty:
      Register run
      Collect IRIs of resources
      Remove obsolete resources
      Finalize
    Else (queue is not empty):
      Update resources by querying a SPARQL endpoint with their IRIs
      If queue is empty:
        Sync data to data platform
      Finalize
  */

  const workflow = setup({
    types: {} as {
      input: Input;
      context: Input & {
        startTime: number;
        logger: pino.Logger;
        queue: Queue;
        queueSize: number;
        registry: Registry;
        runs: Runs;
        continueRun: boolean;
      };
    },
    actors: {
      finalize,
      generate,
      getQueueSize,
      iterate,
      registerRun,
      registerRunAndCheckIfRunMustContinue,
      removeObsoleteResources,
      updateService,
    },
  }).createMachine({
    id: 'main',
    initial: 'getQueueSize',
    context: ({input}) => ({
      ...input,
      startTime: Date.now(),
      logger: getLogger(),
      queue,
      queueSize: 0,
      registry,
      runs,
      continueRun: false,
    }),
    states: {
      // State 1a
      getQueueSize: {
        invoke: {
          id: 'getQueueSize',
          src: 'getQueueSize',
          input: ({context}) => context,
          onDone: {
            target: 'evaluateQueue',
            actions: assign({
              queueSize: ({event}) => event.output,
            }),
          },
        },
      },
      // State 1b
      evaluateQueue: {
        always: [
          {
            target: 'registerRunAndCheckIfRunMustContinue',
            guard: ({context}) =>
              context.queueSize === 0 &&
              context.checkIfRunMustContinueQueryFile !== undefined,
          },
          {
            target: 'registerRun',
            guard: ({context}) => context.queueSize === 0,
          },
          {
            target: 'updateResources',
          },
        ],
      },
      // State 2a
      registerRunAndCheckIfRunMustContinue: {
        invoke: {
          id: 'registerRunAndCheckIfRunMustContinue',
          src: 'registerRunAndCheckIfRunMustContinue',
          input: ({context}) => ({
            ...context,
            endpointUrl: context.checkEndpointUrl!,
            queryFile: context.checkIfRunMustContinueQueryFile!,
            timeout: context.checkIfRunMustContinueTimeout,
          }),
          onDone: {
            target: 'evaluateIfRunMustContinue',
            actions: assign({
              continueRun: ({event}) => event.output,
            }),
          },
        },
      },
      // State 2b
      evaluateIfRunMustContinue: {
        always: [
          {
            target: 'initUpdateOfResources',
            guard: ({context}) => context.continueRun,
          },
          {
            target: 'finalize',
          },
        ],
      },
      // State 3
      registerRun: {
        invoke: {
          id: 'registerRun',
          src: 'registerRun',
          input: ({context}) => context,
          onDone: 'initUpdateOfResources',
        },
      },
      // State 4
      initUpdateOfResources: {
        initial: 'iterate',
        states: {
          // State 4a
          iterate: {
            invoke: {
              id: 'iterate',
              src: 'iterate',
              input: ({context}) => ({
                ...context,
                endpointUrl: context.iterateEndpointUrl,
                queryFile: context.iterateQueryFile,
                waitBetweenRequests: context.iterateWaitBetweenRequests,
                timeoutPerRequest: context.iterateTimeoutPerRequest,
                numberOfIrisPerRequest: context.iterateNumberOfIrisPerRequest,
              }),
              onDone: 'removeObsoleteResources',
            },
          },
          // State 4b
          removeObsoleteResources: {
            invoke: {
              id: 'removeObsoleteResources',
              src: 'removeObsoleteResources',
              input: ({context}) => context,
              onDone: '#main.finalize',
            },
          },
        },
      },
      // State 5
      updateResources: {
        initial: 'generate',
        states: {
          // State 5a
          generate: {
            invoke: {
              id: 'generate',
              src: 'generate',
              input: ({context}) => ({
                ...context,
                endpointUrl: context.generateEndpointUrl,
                queryFile: context.generateQueryFile,
                waitBetweenRequests: context.generateWaitBetweenRequests,
                timeoutPerRequest: context.generateTimeoutPerRequest,
                numberOfConcurrentRequests:
                  context.generateNumberOfConcurrentRequests,
                batchSize: context.generateBatchSize,
              }),
              onDone: 'getQueueSize',
            },
          },
          // State 5b
          getQueueSize: {
            invoke: {
              id: 'getQueueSize',
              src: 'getQueueSize',
              input: ({context}) => context,
              onDone: {
                target: 'evaluateQueue',
                actions: assign({
                  queueSize: ({event}) => event.output,
                }),
              },
            },
          },
          // State 5c
          evaluateQueue: {
            always: [
              {
                // Only allowed to sync the generated resources if all items
                // in the queue have been processed
                target: 'updateService',
                guard: ({context}) => context.queueSize === 0,
              },
              {
                target: '#main.finalize',
              },
            ],
          },
          // State 5d
          // This action fails if another process is already
          // syncing resources to the data platform
          updateService: {
            invoke: {
              id: 'updateService',
              src: 'updateService',
              input: ({context}) => context,
              onDone: '#main.finalize',
            },
          },
        },
      },
      // State 6
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
