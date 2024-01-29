import {type queueAsPromised} from 'fastq';
import got, {Got} from 'got';
import {EventEmitter} from 'node:events';
import {setTimeout} from 'node:timers/promises';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  collectionIri: z.string(),
  dateLastRun: z.date().optional(), // Not set if the client hasn't run before
  waitBetweenRequests: z.number().min(0).default(0),
  credentials: z
    .object({
      type: z.literal('basic-auth'), // Only supported type at this moment
      username: z.string(),
      password: z.string(),
    })
    .optional(),
  queue: z.any().refine(val => val !== undefined, {
    message: 'queue must be defined',
  }),
});

export type ConstructorOptions = z.input<typeof constructorOptionsSchema>;

const collectionResponseSchema = z.object({
  last: z.object({
    id: z.string().url(),
  }),
});

const addActivitySchema = z.object({
  type: z.literal('Add'),
  target: z.object({
    id: z.string().url(),
  }),
  object: z.object({
    id: z.string().url(),
  }),
  endTime: z.coerce.date(),
});

const createUpdateDeleteActivitySchema = z.object({
  type: z.enum(['Create', 'Delete', 'Update']),
  object: z.object({
    id: z.string().url(),
  }),
  endTime: z.coerce.date(),
});

const moveActivitySchema = z.object({
  type: z.literal('Move'),
  target: z.object({
    id: z.string().url(),
  }),
  object: z.object({
    id: z.string().url(),
  }),
  endTime: z.coerce.date(),
});

const refreshActivitySchema = z.object({
  type: z.literal('Refresh'),
  startTime: z.coerce.date(),
});

const removeActivitySchema = z.object({
  type: z.literal('Remove'),
  origin: z.object({
    id: z.string().url(),
  }),
  object: z.object({
    id: z.string().url(),
  }),
  endTime: z.coerce.date(),
});

const pageResponseSchema = z.object({
  prev: z
    .object({
      id: z.string().url(),
    })
    .optional(),
  orderedItems: z.array(
    z.union([
      addActivitySchema,
      createUpdateDeleteActivitySchema,
      moveActivitySchema,
      refreshActivitySchema,
      removeActivitySchema,
    ])
  ),
});

export class ChangeDiscoverer extends EventEmitter {
  private readonly collectionIri: string;
  private readonly dateLastRun?: Date;
  private readonly waitBetweenRequests: number;
  private readonly processablePages: string[] = [];
  private readonly processedItems: Set<string> = new Set();
  private readonly httpClient: Got;
  private readonly queue: queueAsPromised<Record<string, string>>;

  constructor(options: ConstructorOptions) {
    super();

    const opts = constructorOptionsSchema.parse(options);

    this.collectionIri = opts.collectionIri;
    this.dateLastRun = opts.dateLastRun;
    this.waitBetweenRequests = opts.waitBetweenRequests;

    const requestOptions: Record<string, string> = {};

    if (opts.credentials !== undefined) {
      requestOptions.username = opts.credentials.username;
      requestOptions.password = opts.credentials.password;
    }

    this.httpClient = got.extend(requestOptions);
    this.queue = opts.queue;
  }

  private async pushToQueue(iri: string, type: string) {
    // Use a queue to have more control compared to an event emit() - https://www.youtube.com/watch?v=Ra7Ji9LmG9o
    this.queue.push({iri, type}).catch(err => {
      const prettyError = new Error(
        `An error occurred when pushing "${type}" event for "${iri}" to queue: ${err.message}`
      );
      prettyError.stack = err.stack;
      this.emit('error', prettyError);
    });
  }

  // https://iiif.io/api/discovery/1.0/#page-algorithm
  private async processPage(pageIri: string) {
    this.emit('process-page', pageIri, this.dateLastRun);

    const body = await this.httpClient(pageIri).json();
    const page = pageResponseSchema.parse(body);
    const activities = page.orderedItems.reverse(); // From new to old
    let onlyDelete = false;

    for (const activity of activities) {
      if (activity.type !== 'Refresh') {
        // Step 1: only process changes that haven't been processed before
        if (activity.endTime < this.dateLastRun!) {
          this.emit('terminate', activity.endTime);
          return;
        }
      }

      // Step 2
      if (activity.type === 'Refresh') {
        // "Applications that have not processed the stream previously
        // can simply stop when the Refresh activity is encountered"
        if (this.dateLastRun === undefined) {
          this.emit('terminate', activity.startTime);
          return;
        }

        // "Consuming applications that have processed the stream previously should continue
        // to read backwards beyond this point, in order to process any Delete activities,
        // but do not need to process other activity types"
        onlyDelete = true;
      }

      if (activity.type !== 'Refresh') {
        // Step 3: do not re-process processed items
        if (this.processedItems.has(activity.object.id)) {
          this.emit('processed-before', activity.object.id);
          continue;
        }
      }

      // Step 4: check for item type. Currently not supported

      // Step 5a
      if (activity.type === 'Delete') {
        await this.pushToQueue(activity.object.id, 'delete');
      }

      // Step 5b
      if (activity.type === 'Remove') {
        const originId = activity.origin.id;
        if (originId === this.collectionIri) {
          await this.pushToQueue(activity.object.id, 'remove');
        }
      }

      // Step 6
      if (onlyDelete) {
        this.emit('only-delete');
        continue;
      }

      // Step 7a
      if (activity.type === 'Create') {
        await this.pushToQueue(activity.object.id, 'create');
      }

      // Step 7b
      if (activity.type === 'Update') {
        await this.pushToQueue(activity.object.id, 'update');
      }

      // Step 7c
      if (activity.type === 'Add') {
        const targetId = activity.target.id;
        if (targetId === this.collectionIri) {
          await this.pushToQueue(activity.object.id, 'add');
        }
      }

      // Step 8
      if (activity.type === 'Move') {
        await this.pushToQueue(activity.object.id, 'move-delete');
        await this.pushToQueue(activity.target.id, 'move-create');
      }

      // Step 9
      // Beware: this list consumes a lot of memory for large activity streams
      if (activity.type !== 'Refresh') {
        this.processedItems.add(activity.object.id);
      }
    }

    // Process items on the previous page, if any
    const prevPageIri = page.prev?.id;
    if (prevPageIri !== undefined) {
      this.processablePages.push(prevPageIri);
    }
  }

  // https://iiif.io/api/discovery/1.0/#collection-algorithm
  private async processCollection() {
    this.emit('process-collection', this.collectionIri);

    const body = await this.httpClient(this.collectionIri).json();
    const collection = collectionResponseSchema.parse(body);
    const lastPageIri = collection.last.id;
    this.processablePages.push(lastPageIri);

    do {
      const pageIri = this.processablePages.pop();
      /* c8 ignore next 3 - never reached but required to satisfy TS compiler */
      if (pageIri === undefined) {
        break;
      }
      await this.processPage(pageIri);

      // Try not to hurt the server or trigger its rate limiter
      await setTimeout(this.waitBetweenRequests);
    } while (this.processablePages.length > 0);
  }

  async run() {
    await this.processCollection();
  }
}
