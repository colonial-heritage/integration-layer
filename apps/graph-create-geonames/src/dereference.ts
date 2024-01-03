import {ProgressLogger} from '@colonial-collections/common';
import {Queue} from '@colonial-collections/datastore';
import {DereferenceStorer} from '@colonial-collections/dereference-storer';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  queue: z.instanceof(Queue),
  type: z.string().optional(),
  resourceDir: z.string(),
  credentials: z
    .object({
      type: z.literal('basic-auth'),
      username: z.string(),
      password: z.string(),
    })
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
  waitBetweenRequests: z.number().optional(),
  timeoutPerRequest: z.number().optional(),
  numberOfConcurrentRequests: z.number().optional(),
  batchSize: z.number().optional(),
});

export type Input = z.input<typeof inputSchema>;

export const dereference = fromPromise(async ({input}: {input: Input}) => {
  const opts = inputSchema.parse(input);

  opts.logger.info('Dereferencing resources');

  const storer = new DereferenceStorer({
    logger: opts.logger,
    resourceDir: opts.resourceDir,
    credentials: opts.credentials,
    headers: opts.headers,
  });

  const progress = new ProgressLogger({logger: opts.logger});
  storer.on(
    'stored-resource',
    (totalNumberOfResources: number, numberOfProcessedResources: number) => {
      progress.log({
        totalNumberOfResources,
        numberOfProcessedResources,
      });
    }
  );

  await storer.run({
    queue: opts.queue,
    type: opts.type,
    numberOfConcurrentRequests: opts.numberOfConcurrentRequests,
    waitBetweenRequests: opts.waitBetweenRequests,
    batchSize: opts.batchSize,
  });

  const queueSize = await opts.queue.size({type: opts.type});
  opts.logger.info(`There are ${queueSize} items left in the queue`);
});
