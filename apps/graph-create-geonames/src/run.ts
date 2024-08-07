import {fileIterate} from './file-iterate.js';
import {getLogger} from '@colonial-collections/common';
import {
  Connection,
  Queue,
  Registry,
  Runs,
} from '@colonial-collections/datastore';
import {
  dereference,
  finalize,
  getQueueSize,
  iterate,
  registerRun,
  registerRunAndCheckIfRunMustContinue,
  removeResourcesNotInQueue,
  updateService,
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
  dereferenceBatchSize: z.number().optional(), // If undefined: process the entire queue. Mind the hourly and daily limits of GeoNames!
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
    Get size of locations queue
    Get size of countries queue
    If locations queue is empty and countries queue is empty and a 'must run continue' query file is set: (start a new run)
      Register run
      Check if run must continue
      If run must continue:
        Collect IRIs of locations
        Remove obsolete locations
        Check batch size
        If batch size of queue is not set or greater than the queue size:
          Go to 'Update locations by dereferencing IRIs'
      Finalize
    Else if locations queue is empty and countries queue is empty: (start a new run)
      Register run
      Collect IRIs of locations
      Remove obsolete locations
      Check batch size
      If batch size of queue is not set or greater than the queue size:
        Go to 'Update locations by dereferencing IRIs'
      Finalize
    Else if locations queue is not empty:
      Update locations by dereferencing IRIs
      If locations queue is empty:
        Collect IRIs of countries
        Remove obsolete countries
        Check batch size
        If batch size of queue is not set or greater than the queue size:
          Go to 'Update countries by dereferencing IRIs'
      Finalize
    Else if countries queue is not empty:
      Update countries by dereferencing IRIs
      If countries queue is empty:
        Sync to data platform
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
      dereference,
      fileIterate,
      finalize,
      getQueueSize,
      iterate,
      registerRun,
      registerRunAndCheckIfRunMustContinue,
      removeResourcesNotInQueue,
      updateService,
    },
  }).createMachine({
    id: 'main',
    initial: 'getLocationsQueueSize',
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
      getLocationsQueueSize: {
        invoke: {
          id: 'checkLocationsQueue',
          src: 'getQueueSize',
          input: ({context}) => ({
            queue: context.queue,
            type: 'locations',
          }),
          onDone: {
            target: 'getCountriesQueueSize',
            actions: assign({
              locationsQueueSize: ({event}) => event.output,
            }),
          },
        },
      },
      // State 1b
      getCountriesQueueSize: {
        invoke: {
          id: 'getCountriesQueueSize',
          src: 'getQueueSize',
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
              src: 'removeResourcesNotInQueue',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                type: 'locations',
                resourceDir: context.locationsResourceDir,
              }),
              onDone: 'getLocationsQueueSize',
            },
          },
          // State 4c
          // The 'iterateLocations' state has changed the initial queue size - fetch it again
          getLocationsQueueSize: {
            invoke: {
              id: 'getQueueSize',
              src: 'getQueueSize',
              input: ({context}) => context,
              onDone: {
                target: 'evaluateIfLocationsMustBeUpdatedNow',
                actions: assign({
                  locationsQueueSize: ({event}) => event.output,
                }),
              },
            },
          },
          // State 4d
          evaluateIfLocationsMustBeUpdatedNow: {
            always: [
              {
                target: '#main.updateLocations',
                guard: ({context}) =>
                  context.dereferenceBatchSize === undefined ||
                  context.dereferenceBatchSize >= context.locationsQueueSize,
              },
              {
                target: '#main.finalize',
              },
            ],
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
                timeoutPerRequest: context.dereferenceTimeoutPerRequest,
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
              src: 'getQueueSize',
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
        initial: 'iterateCountries',
        states: {
          // State 6a
          iterateCountries: {
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
              src: 'removeResourcesNotInQueue',
              input: ({context}) => ({
                ...context,
                queue: context.queue,
                type: 'countries',
                resourceDir: context.countriesResourceDir,
              }),
              onDone: 'getCountriesQueueSize',
            },
          },
          // State 6c
          // The 'iterateCountries' state has changed the initial queue size - fetch it again
          getCountriesQueueSize: {
            invoke: {
              id: 'getQueueSize',
              src: 'getQueueSize',
              input: ({context}) => context,
              onDone: {
                target: 'evaluateIfCountriesMustBeUpdatedNow',
                actions: assign({
                  countriesQueueSize: ({event}) => event.output,
                }),
              },
            },
          },
          // State 6d
          evaluateIfCountriesMustBeUpdatedNow: {
            always: [
              {
                target: '#main.updateCountries',
                guard: ({context}) =>
                  context.dereferenceBatchSize === undefined ||
                  context.dereferenceBatchSize >= context.countriesQueueSize,
              },
              {
                target: '#main.finalize',
              },
            ],
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
                timeoutPerRequest: context.dereferenceTimeoutPerRequest,
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
              src: 'getQueueSize',
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
                // Only allowed to sync the generated resources if all items
                // in the queue have been processed
                target: 'updateService',
                guard: ({context}) => context.countriesQueueSize === 0,
              },
              {
                target: '#main.finalize',
              },
            ],
          },
          // State 7d
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
