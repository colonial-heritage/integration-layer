import {Queue} from '@colonial-collections/datastore';
import {SparqlIterator} from '@colonial-collections/sparql-iterator';
import fastq from 'fastq';
import {readFile} from 'node:fs/promises';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  queue: z.instanceof(Queue),
  type: z.string().optional(),
  endpointUrl: z.string(),
  queryFile: z.string(),
  waitBetweenRequests: z.number().optional(),
  timeoutPerRequest: z.number().optional(),
  numberOfIrisPerRequest: z.number().optional(),
});

export type IterateInput = z.input<typeof inputSchema>;

export const iterate = fromPromise(async ({input}: {input: IterateInput}) => {
  const opts = inputSchema.parse(input);

  opts.logger.info(
    `Collecting IRIs from SPARQL endpoint "${opts.endpointUrl}"`
  );

  const save = async (iri: string) => opts.queue.push({iri, type: opts.type});
  const iteratorQueue = fastq.promise(save, 1); // Concurrency
  const query = await readFile(opts.queryFile, 'utf-8');

  const iterator = new SparqlIterator({
    endpointUrl: opts.endpointUrl,
    waitBetweenRequests: opts.waitBetweenRequests,
    timeoutPerRequest: opts.timeoutPerRequest,
    numberOfIrisPerRequest: opts.numberOfIrisPerRequest,
    query,
    queue: iteratorQueue,
  });

  iterator.on('warning', (err: Error) => opts.logger.warn(err));
  iterator.on('error', (err: Error) => opts.logger.error(err));
  iterator.on(
    'collected-iris',
    (numberOfIris: number, limit: number, offset: number) => {
      opts.logger.info(
        `Collected ${numberOfIris} IRIs from offset ${offset} to ${
          offset + numberOfIris
        }`
      );
    }
  );

  await iterator.run();
});
