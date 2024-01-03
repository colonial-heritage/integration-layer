import {Queue} from '@colonial-collections/datastore';
import {SparqlFileIterator} from '@colonial-collections/sparql-file-iterator';
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
  resourceDir: z.string(),
  queryFile: z.string(),
});

export type Input = z.input<typeof inputSchema>;

export const fileIterate = fromPromise(async ({input}: {input: Input}) => {
  const opts = inputSchema.parse(input);

  opts.logger.info(`Collecting IRIs from "${opts.resourceDir}"`);

  const save = async (iri: string) => opts.queue.push({iri, type: opts.type});
  const iteratorQueue = fastq.promise(save, 1); // Concurrency
  const query = await readFile(opts.queryFile, 'utf-8');

  const iterator = new SparqlFileIterator({
    dir: opts.resourceDir,
    query,
    queue: iteratorQueue,
  });

  iterator.on('error', (err: Error) => opts.logger.error(err));
  iterator.on('collected-iris', (numberOfIris: number, filename: string) => {
    opts.logger.info(`Collected ${numberOfIris} IRIs from "${filename}"`);
  });

  await iterator.run();
});
