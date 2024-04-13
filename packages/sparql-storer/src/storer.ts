import {toChunks} from './array-to-chunks.js';
import {Queue, QueueItem} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {SparqlGenerator} from '@colonial-collections/sparql-generator';
import EventEmitter from 'events';
import fastq from 'fastq';
import {setTimeout} from 'node:timers/promises';
import type {pino} from 'pino';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  resourceDir: z.string(),
  endpointUrl: z.string(),
  query: z.string(),
  timeoutPerRequest: z.number().min(0).default(60000),
});

export type ConstructorOptions = z.input<typeof constructorOptionsSchema>;

const runOptionsSchema = z.object({
  queue: z.instanceof(Queue),
  type: z.string().optional(),
  numberOfResourcesPerRequest: z.number().min(1).default(1),
  numberOfConcurrentRequests: z.number().min(1).default(1),
  waitBetweenRequests: z.number().min(0).optional(),
  batchSize: z.number().min(1).optional(), // Undefined if the entire queue must be processed
});

export type RunOptions = z.input<typeof runOptionsSchema>;

export class SparqlStorer extends EventEmitter {
  private readonly logger: pino.Logger;
  private readonly filestore: Filestore;
  private readonly generator: SparqlGenerator;

  constructor(options: ConstructorOptions) {
    super();

    const opts = constructorOptionsSchema.parse(options);

    this.logger = opts.logger;
    this.filestore = new Filestore({dir: opts.resourceDir});
    this.generator = new SparqlGenerator({
      endpointUrl: opts.endpointUrl,
      timeoutPerRequest: opts.timeoutPerRequest,
      query: opts.query,
    });
    this.generator.on('warning', (err: Error) => this.logger.warn(err));
  }

  async run(options: RunOptions) {
    const opts = runOptionsSchema.parse(options);

    const allItems = await opts.queue.getAll({
      limit: opts.batchSize,
      type: opts.type,
    });

    this.logger.info(`Processing ${allItems.length} items from the queue`);
    let numberOfProcessedResources = 0;

    const process = async (items: QueueItem[]) => {
      const irisOfItems = items.map(item => item.iri);
      const quadStream = await this.generator.getResources(irisOfItems);
      const id = irisOfItems.join(); // One ID for all items in this set
      await this.filestore.save({id, quadStream});

      for (const item of items) {
        await opts.queue.processAndSave(item);
      }

      numberOfProcessedResources += items.length;
      this.emit(
        'processed-resource',
        allItems.length,
        numberOfProcessedResources
      );

      await setTimeout(opts.waitBetweenRequests); // Try not to hurt the server or trigger its rate limiter
    };

    const processQueue = fastq.promise(
      process,
      opts.numberOfConcurrentRequests
    );

    // Split items into chunks: [1, 2, 3, 4, 5] => [[1, 2], [3, 4], [5]]
    const chunks = [...toChunks(allItems, opts.numberOfResourcesPerRequest)];
    let erroredItems: QueueItem[] = [];

    for (const items of chunks) {
      // Do not 'await processQueue.push(item)' - it processes items sequentially, not in parallel
      processQueue.push(items).catch(err => {
        const irisOfItems = items.map(item => item.iri);
        this.logger.error(
          err,
          `An error occurred when processing "${irisOfItems.join(', ')}": ${
            err.message
          }`
        );

        // We cannot retry the errored items in the catch(): that's an async action
        erroredItems = erroredItems.concat(items);
      });
    }

    await processQueue.drained();

    for (const item of erroredItems) {
      try {
        await opts.queue.retry(item);
      } catch (err) {
        this.logger.error(err);
      }
    }
  }
}
