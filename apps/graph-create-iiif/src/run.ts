import {iterate} from './iterate.js';
import {getLogger} from '@colonial-collections/common';
import {
  Connection,
  Queue,
  Registry,
  Runs,
  RunItem,
} from '@colonial-collections/datastore';
import {
  dereference,
  finalize,
  getLastRun,
  getQueueSize,
  registerRun,
  updateService,
} from '@colonial-collections/xstate-actors';
import type {pino} from 'pino';
import {assign, createActor, setup, toPromise} from 'xstate';
import {z} from 'zod';

const credentialsSchema = z.object({
  type: z.literal('basic-auth'),
  username: z.string(),
  password: z.string(),
});

const inputSchema = z.object({
  resourceDir: z.string(),
  dataFile: z.string(),
  iterateEndpointUrl: z.string(),
  iterateCredentials: credentialsSchema.optional(),
  iterateWaitBetweenRequests: z.number().default(100),
  dereferenceCredentials: credentialsSchema.optional(),
  dereferenceHeaders: z.record(z.string(), z.string()).optional(),
  dereferenceWaitBetweenRequests: z.number().default(100),
  dereferenceTimeoutPerRequest: z.number().optional(),
  dereferenceNumberOfConcurrentRequests: z.number().default(20), // ~ single-threaded max performance
  dereferenceBatchSize: z.number().optional(), // If undefined: process the entire queue
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
    If queue is empty:
      Get last run
      Register new run
      Collect IRIs
      Check batch size
      If batch size of queue is not set or greater than the queue size:
        Go to 'Else'
      Finalize
    Else (queue is not empty):
      Process collected IRIs: dereference or delete
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
        lastRun: RunItem | undefined;
      };
    },
    actors: {
      dereference,
      finalize,
      getLastRun,
      getQueueSize,
      iterate,
      registerRun,
      updateService,
    },
  }).createMachine({
    id: 'main',
    initial: 'getInitialQueueSize',
    context: ({input}) => ({
      ...input,
      startTime: Date.now(),
      logger: getLogger(),
      queue,
      queueSize: 0,
      registry,
      runs,
      lastRun: undefined,
    }),
    states: {
      // State 1
      getInitialQueueSize: {
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
      // State 2
      evaluateQueue: {
        always: [
          {
            target: 'getLastRun',
            guard: ({context}) => context.queueSize === 0,
          },
          {
            target: 'updateResources',
          },
        ],
      },
      // State 3
      getLastRun: {
        invoke: {
          id: 'getLastRun',
          src: 'getLastRun',
          input: ({context}) => context,
          onDone: {
            target: 'registerRun',
            actions: assign({
              lastRun: ({event}) => event.output,
            }),
          },
        },
      },
      // State 4
      registerRun: {
        invoke: {
          id: 'registerRun',
          src: 'registerRun',
          input: ({context}) => context,
          onDone: 'iterate',
        },
      },
      // State 5
      iterate: {
        invoke: {
          id: 'iterate',
          src: 'iterate',
          input: ({context}) => ({
            ...context,
            dateLastRun: context.lastRun?.created_at,
            collectionIri: context.iterateEndpointUrl,
            credentials: context.iterateCredentials,
            waitBetweenRequests: context.iterateWaitBetweenRequests,
          }),
          onDone: 'getAfterIterateQueueSize',
        },
      },
      // State 6
      // The 'iterate' state has changed the initial queue size - fetch it again
      getAfterIterateQueueSize: {
        invoke: {
          id: 'getQueueSize',
          src: 'getQueueSize',
          input: ({context}) => context,
          onDone: {
            target: 'evaluateIfResourcesMustBeUpdatedNow',
            actions: assign({
              queueSize: ({event}) => event.output,
            }),
          },
        },
      },
      // State 7
      evaluateIfResourcesMustBeUpdatedNow: {
        always: [
          {
            target: 'updateResources',
            guard: ({context}) =>
              context.queueSize > 0 &&
              (context.dereferenceBatchSize === undefined ||
                context.dereferenceBatchSize >= context.queueSize),
          },
          {
            target: 'finalize',
          },
        ],
      },
      // State 8
      updateResources: {
        initial: 'dereference',
        states: {
          // State 8a
          dereference: {
            invoke: {
              id: 'dereference',
              src: 'dereference',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                resourceDir: context.resourceDir,
                credentials: context.dereferenceCredentials,
                headers: context.dereferenceHeaders,
                waitBetweenRequests: context.dereferenceWaitBetweenRequests,
                timeoutPerRequest: context.dereferenceTimeoutPerRequest,
                numberOfConcurrentRequests:
                  context.dereferenceNumberOfConcurrentRequests,
                batchSize: context.dereferenceBatchSize,
              }),
              onDone: 'getQueueSize',
            },
          },
          // State 8b
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
          // State 8c
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
          // State 8d
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
      // State 9
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
