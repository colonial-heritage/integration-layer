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
  numberOfConcurrentRequests: z.number().min(1).default(1),
  waitBetweenRequests: z.number().min(0).optional(),
  batchSize: z.number().min(1).default(1000),
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

    const items = await opts.queue.getAll({
      limit: opts.batchSize,
      type: opts.type,
    });

    this.logger.info(`Processing ${items.length} items from the queue`);
    let numberOfProcessedResources = 0;

    const process = async (item: QueueItem) => {
      const quadStream = await this.generator.getResource(item.iri);
      await this.filestore.save({iri: item.iri, quadStream});
      await opts.queue.processAndSave(item);
      await setTimeout(opts.waitBetweenRequests); // Try not to hurt the server or trigger its rate limiter

      numberOfProcessedResources++;
      this.emit('processed-resource', items.length, numberOfProcessedResources);
    };

    const processQueue = fastq.promise(
      process,
      opts.numberOfConcurrentRequests
    );

    for (const item of items) {
      // Do not 'await processQueue.push(item)' - it processes items sequentially, not in parallel
      processQueue.push(item).catch(async err => {
        this.logger.error(
          err,
          `An error occurred when processing "${item.iri}": ${err.message}`
        );

        try {
          await opts.queue.retry(item);
        } catch (err) {
          this.logger.error(err);
        }
      });
    }

    await processQueue.drained();
  }
}
