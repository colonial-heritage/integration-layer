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
  batchSize: z.number().min(1).optional(), // Undefined if the entire queue must be processed
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

  private async process(options: RunOptions, item: QueueItem) {
    if (item.action === 'delete') {
      await this.filestore.deleteByIri(item.iri);
      await options.queue.processAndRemove(item);
      return;
    }

    // It's a create or update action
    await setTimeout(options.waitBetweenRequests); // Try not to hurt the server or trigger its rate limiter

    try {
      const quadStream = await this.dereferencer.getResource(item.iri);
      await this.filestore.save({iri: item.iri, quadStream});
      await options.queue.processAndSave(item);
    } catch (err) {
      // A lookup may result in a '4xx' status. We then assume the resource
      // does not or no longer exists and must be deleted from the local store
      const isDoesNotExistError = Dereferencer.isDoesNotExistError(
        err as Error
      );

      // It's an error of a different kind
      if (!isDoesNotExistError) {
        throw err; // TBD: send to dead letter queue?
      }

      await this.filestore.deleteByIri(item.iri);
      await options.queue.processAndRemove(item);
    }
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
      try {
        await this.process(opts, item);
        // eslint-disable-next-line no-useless-catch
      } catch (err) {
        throw err;
      } finally {
        numberOfProcessedResources++;
        this.emit(
          'processed-resource',
          items.length,
          numberOfProcessedResources
        );
      }
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
