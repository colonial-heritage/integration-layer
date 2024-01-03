import {Queue, QueueItem} from '@colonial-collections/datastore';
import {Dereferencer} from '@colonial-collections/dereferencer';
import {Filestore} from '@colonial-collections/filestore';
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
  credentials: z
    .object({
      type: z.literal('basic-auth'), // Only supported type at this moment
      username: z.string(),
      password: z.string(),
    })
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
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

export class DereferenceStorer extends EventEmitter {
  private readonly logger: pino.Logger;
  private readonly filestore: Filestore;
  private readonly dereferencer: Dereferencer;

  constructor(options: ConstructorOptions) {
    super();

    const opts = constructorOptionsSchema.parse(options);

    this.logger = opts.logger;
    this.filestore = new Filestore({dir: opts.resourceDir});
    this.dereferencer = new Dereferencer({
      credentials: opts.credentials,
      headers: opts.headers,
    });
    this.dereferencer.on('warning', (err: Error) => this.logger.warn(err));
  }

  async run(options: RunOptions) {
    const opts = runOptionsSchema.parse(options);

    const items = await opts.queue.getAll({
      limit: opts.batchSize,
      type: opts.type,
    });

    this.logger.info(`Storing ${items.length} items from the queue`);
    let numberOfProcessedResources = 0;

    const save = async (item: QueueItem) => {
      const quadStream = await this.dereferencer.getResource(item.iri);
      await this.filestore.save({iri: item.iri, quadStream});
      await opts.queue.processed(item);
      await setTimeout(opts.waitBetweenRequests); // Try not to hurt the server or trigger its rate limiter

      numberOfProcessedResources++;
      this.emit('stored-resource', items.length, numberOfProcessedResources);
    };

    const saveQueue = fastq.promise(save, opts.numberOfConcurrentRequests);

    for (const item of items) {
      saveQueue.push(item).catch(async err => {
        this.logger.error(
          err,
          `An error occurred when saving "${item.iri}": ${err.message}`
        );

        try {
          await opts.queue.retry(item);
        } catch (err) {
          this.logger.error(err);
        }
      });
    }

    await saveQueue.drained();
  }
}
