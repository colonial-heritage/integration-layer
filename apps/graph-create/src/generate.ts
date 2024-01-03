import {ProgressLogger} from '@colonial-collections/common';
import {Queue} from '@colonial-collections/datastore';
import {SparqlStorer} from '@colonial-collections/sparql-storer';
import {readFile} from 'node:fs/promises';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  queue: z.instanceof(Queue),
  resourceDir: z.string(),
  endpointUrl: z.string(),
  queryFile: z.string(),
  waitBetweenRequests: z.number().optional(),
  timeoutPerRequest: z.number().optional(),
  numberOfConcurrentRequests: z.number().optional(),
  batchSize: z.number().optional(),
});

export type Input = z.input<typeof inputSchema>;

export const generate = fromPromise(async ({input}: {input: Input}) => {
  const opts = inputSchema.parse(input);

  opts.logger.info(
    `Generating resources from SPARQL endpoint "${opts.endpointUrl}"`
  );

  const query = await readFile(opts.queryFile, 'utf-8');
  const storer = new SparqlStorer({
    logger: opts.logger,
    resourceDir: opts.resourceDir,
    endpointUrl: opts.endpointUrl,
    timeoutPerRequest: opts.timeoutPerRequest,
    query,
  });

  const progress = new ProgressLogger({logger: opts.logger});
  storer.on(
    'stored-resource',
    (totalNumberOfResources: number, numberOfProcessedResources: number) => {
      progress.log({totalNumberOfResources, numberOfProcessedResources});
    }
  );

  await storer.run({
    queue: opts.queue,
    waitBetweenRequests: opts.waitBetweenRequests,
    numberOfConcurrentRequests: opts.numberOfConcurrentRequests,
    batchSize: opts.batchSize,
  });

  const queueSize = await opts.queue.size();
  opts.logger.info(`There are ${queueSize} items left in the queue`);
});
