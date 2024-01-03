import {dereference} from './dereference.js';
import {fileIterate} from './file-iterate.js';
import {getLogger} from '@colonial-collections/common';
import {
  Connection,
  Queue,
  Registry,
  Runs,
} from '@colonial-collections/datastore';
import {
  checkQueue,
  finalize,
  iterate,
  registerRun,
  registerRunAndCheckIfRunMustContinue,
  removeObsoleteResources,
  upload,
} from '@colonial-collections/xstate-actors';
import {join} from 'node:path';
import type {pino} from 'pino';
import {assign, createActor, setup, toPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  resourceDir: z.string(),
  dataFile: z.string(),
  checkEndpointUrl: z.string().optional(),
  checkIfRunMustContinueQueryFile: z.string().optional(),
  checkIfRunMustContinueTimeout: z.number().optional(),
  iterateLocationsQueryFile: z.string(),
  iterateCountriesQueryFile: z.string(),
  iterateEndpointUrl: z.string(),
  iterateWaitBetweenRequests: z.number().default(500),
  iterateTimeoutPerRequest: z.number().optional(),
  iterateNumberOfIrisPerRequest: z.number().default(10000),
  dereferenceCredentials: z
    .object({
      type: z.literal('basic-auth'),
      username: z.string(),
      password: z.string(),
    })
    .optional(),
  dereferenceHeaders: z.record(z.string(), z.string()).optional(),
  dereferenceWaitBetweenRequests: z.number().default(100),
  dereferenceTimeoutPerRequest: z.number().optional(),
  dereferenceNumberOfConcurrentRequests: z.number().default(5),
  dereferenceBatchSize: z.number().default(750), // Mind the hourly and daily limits of GeoNames
  triplydbInstanceUrl: z.string(),
  triplydbApiToken: z.string(),
  triplydbAccount: z.string(),
  triplydbDataset: z.string(),
  triplydbServiceName: z.string(),
  triplydbServiceType: z.string(),
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
    If locations queue is empty and countries queue is empty and a 'must run continue' query file is set: (start a new run)
      Register run
      Check if run must continue
      If run must continue:
        Collect IRIs of locations
        Remove obsolete locations
      Finalize
    Else if locations queue is empty and countries queue is empty: (start a new run)
      Register run
      Collect IRIs of locations
      Remove obsolete locations
      Finalize
    Else if locations queue is not empty:
      Update locations by dereferencing IRIs
      If locations queue is empty:
        Collect IRIs of countries
        Remove obsolete countries
      Finalize
    Else if countries queue is not empty:
      Update countries by dereferencing IRIs
      If countries queue is empty:
        Upload to data platform
      Finalize
    Else:
      Finalize
  */

  const workflow = setup({
    types: {} as {
      input: Input;
      context: Input & {
        startTime: number;
        logger: pino.Logger;
        queue: Queue;
        registry: Registry;
        runs: Runs;
        continueRun: boolean;
        locationsResourceDir: string;
        locationsQueueSize: number;
        countriesResourceDir: string;
        countriesQueueSize: number;
      };
    },
    actors: {
      checkQueue,
      dereference,
      fileIterate,
      finalize,
      iterate,
      registerRun,
      registerRunAndCheckIfRunMustContinue,
      removeObsoleteResources,
      upload,
    },
  }).createMachine({
    id: 'main',
    initial: 'checkLocationsQueue',
    context: ({input}) => ({
      ...input,
      startTime: Date.now(),
      logger: getLogger(),
      queue,
      registry,
      runs,
      continueRun: false,
      locationsResourceDir: join(input.resourceDir, 'locations'),
      locationsQueueSize: 0,
      countriesResourceDir: join(input.resourceDir, 'countries'),
      countriesQueueSize: 0,
    }),
    states: {
      // State 1a
      checkLocationsQueue: {
        invoke: {
          id: 'checkLocationsQueue',
          src: 'checkQueue',
          input: ({context}) => ({
            queue: context.queue,
            type: 'locations',
          }),
          onDone: {
            target: 'checkCountriesQueue',
            actions: assign({
              locationsQueueSize: ({event}) => event.output,
            }),
          },
        },
      },
      // State 1b
      checkCountriesQueue: {
        invoke: {
          id: 'checkCountriesQueue',
          src: 'checkQueue',
          input: ({context}) => ({
            queue: context.queue,
            type: 'countries',
          }),
          onDone: {
            target: 'evaluateQueues',
            actions: assign({
              countriesQueueSize: ({event}) => event.output,
            }),
          },
        },
      },
      // State 1c
      evaluateQueues: {
        always: [
          {
            target: 'registerRunAndCheckIfRunMustContinue',
            guard: ({context}) =>
              context.locationsQueueSize === 0 &&
              context.countriesQueueSize === 0 &&
              context.checkIfRunMustContinueQueryFile !== undefined,
          },
          {
            target: 'registerRun',
            guard: ({context}) =>
              context.locationsQueueSize === 0 &&
              context.countriesQueueSize === 0,
          },
          {
            target: 'updateLocations',
            guard: ({context}) => context.locationsQueueSize !== 0,
          },
          {
            target: 'updateCountries',
            guard: ({context}) => context.countriesQueueSize !== 0,
          },
          {
            target: 'finalize',
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
            target: 'initUpdateOfLocations',
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
          onDone: 'initUpdateOfLocations',
        },
      },
      // State 4
      initUpdateOfLocations: {
        initial: 'iterateLocations',
        states: {
          // State 4a
          iterateLocations: {
            invoke: {
              id: 'iterateLocations',
              src: 'iterate',
              input: ({context}) => ({
                ...context,
                type: 'locations',
                endpointUrl: context.iterateEndpointUrl,
                queryFile: context.iterateLocationsQueryFile,
                waitBetweenRequests: context.iterateWaitBetweenRequests,
                timeoutPerRequest: context.iterateTimeoutPerRequest,
                numberOfIrisPerRequest: context.iterateNumberOfIrisPerRequest,
              }),
              onDone: 'removeObsoleteLocations',
            },
          },
          // State 4b
          removeObsoleteLocations: {
            invoke: {
              id: 'removeObsoleteLocations',
              src: 'removeObsoleteResources',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                type: 'locations',
                resourceDir: context.locationsResourceDir,
              }),
              onDone: '#main.finalize',
            },
          },
        },
      },
      // State 5
      updateLocations: {
        initial: 'dereferenceLocations',
        states: {
          // State 5a
          dereferenceLocations: {
            invoke: {
              id: 'dereferenceLocations',
              src: 'dereference',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                type: 'locations',
                resourceDir: context.locationsResourceDir,
                credentials: context.dereferenceCredentials,
                headers: context.dereferenceHeaders,
                waitBetweenRequests: context.dereferenceWaitBetweenRequests,
                timeoutPerRequest: context.dereferenceWaitBetweenRequests,
                numberOfConcurrentRequests:
                  context.dereferenceNumberOfConcurrentRequests,
                batchSize: context.dereferenceBatchSize,
              }),
              onDone: 'checkLocationsQueue',
            },
          },
          // State 5b
          checkLocationsQueue: {
            invoke: {
              id: 'checkLocationsQueue',
              src: 'checkQueue',
              input: ({context}) => ({
                queue: context.queue,
                type: 'locations',
              }),
              onDone: {
                target: 'evaluateLocationsQueue',
                actions: assign({
                  locationsQueueSize: ({event}) => event.output,
                }),
              },
            },
          },
          // State 5c
          evaluateLocationsQueue: {
            always: [
              {
                target: '#main.initUpdateOfCountries',
                guard: ({context}) => context.locationsQueueSize === 0,
              },
              {
                target: '#main.finalize',
              },
            ],
          },
        },
      },
      // State 6
      initUpdateOfCountries: {
        initial: 'fileIterate',
        states: {
          // State 6a
          fileIterate: {
            invoke: {
              id: 'fileIterate',
              src: 'fileIterate',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                type: 'countries',
                resourceDir: context.locationsResourceDir,
                queryFile: context.iterateCountriesQueryFile,
              }),
              onDone: 'removeObsoleteCountries',
            },
          },
          // State 6b
          removeObsoleteCountries: {
            invoke: {
              id: 'removeObsoleteCountries',
              src: 'removeObsoleteResources',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                type: 'countries',
                resourceDir: context.countriesResourceDir,
              }),
              onDone: '#main.finalize',
            },
          },
        },
      },
      // State 7
      updateCountries: {
        initial: 'dereferenceCountries',
        states: {
          // State 7a
          dereferenceCountries: {
            invoke: {
              id: 'dereferenceCountries',
              src: 'dereference',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                type: 'countries',
                resourceDir: context.countriesResourceDir,
                credentials: context.dereferenceCredentials,
                headers: context.dereferenceHeaders,
                waitBetweenRequests: context.dereferenceWaitBetweenRequests,
                timeoutPerRequest: context.dereferenceWaitBetweenRequests,
                numberOfConcurrentRequests:
                  context.dereferenceNumberOfConcurrentRequests,
                batchSize: context.dereferenceBatchSize,
              }),
              onDone: 'checkCountriesQueue',
            },
          },
          // State 7b
          checkCountriesQueue: {
            invoke: {
              id: 'checkCountriesQueue',
              src: 'checkQueue',
              input: ({context}) => ({
                queue: context.queue,
                type: 'countries',
              }),
              onDone: {
                target: 'evaluateCountriesQueue',
                actions: assign({
                  countriesQueueSize: ({event}) => event.output,
                }),
              },
            },
          },
          // State 7c
          evaluateCountriesQueue: {
            always: [
              {
                // Only allowed to upload the generated resources if all items
                // in the queue have been processed
                target: 'upload',
                guard: ({context}) => context.countriesQueueSize === 0,
              },
              {
                target: '#main.finalize',
              },
            ],
          },
          // State 7d
          // This action fails if another process is already
          // uploading resources to the data platform
          upload: {
            invoke: {
              id: 'upload',
              src: 'upload',
              input: ({context}) => context,
              onDone: '#main.finalize',
            },
          },
        },
      },
      // State 8
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
