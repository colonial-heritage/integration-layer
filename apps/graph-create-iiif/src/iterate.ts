import {type Action, Queue} from '@colonial-collections/datastore';
import {
  ChangeDiscoverer,
  type QueueRecord,
} from '@colonial-collections/iiif-change-discoverer';
import fastq from 'fastq';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  queue: z.instanceof(Queue),
  dateLastRun: z.coerce.date().optional(), // Not set if no run ran before
  collectionIri: z.string(),
  credentials: z
    .object({
      type: z.literal('basic-auth'),
      username: z.string(),
      password: z.string(),
    })
    .optional(),
  waitBetweenRequests: z.number().optional(),
});

export type IterateInput = z.input<typeof inputSchema>;

const fromChangeTypesToAction = new Map([
  ['add', 'create'],
  ['create', 'create'],
  ['update', 'update'],
  ['delete', 'delete'],
  ['remove', 'delete'],
  ['move-delete', 'delete'],
  ['move-create', 'create'],
]);

export const iterate = fromPromise(async ({input}: {input: IterateInput}) => {
  const opts = inputSchema.parse(input);

  opts.logger.info(
    `Collecting IRIs of changed resources from IIIF Change Discovery endpoint "${opts.collectionIri}"`
  );

  const save = async (record: QueueRecord) => {
    const action = fromChangeTypesToAction.get(record.type) as Action;
    opts.queue.push({iri: record.iri, action});
  };
  const iteratorQueue = fastq.promise(save, 1); // Concurrency

  const discoverer = new ChangeDiscoverer({
    collectionIri: opts.collectionIri,
    dateLastRun: opts.dateLastRun,
    waitBetweenRequests: opts.waitBetweenRequests,
    credentials: opts.credentials,
    queue: iteratorQueue,
  });

  // Some logging to see what's going on
  discoverer.on('process-collection', (iri: string) =>
    opts.logger.info(`Processing pages in collection "${iri}"`)
  );
  // discoverer.on('process-page', (iri: string, dateLastRun?: Date) => {
  //   const date =
  //     dateLastRun instanceof Date ? dateLastRun.toISOString() : 'the beginning';
  //   opts.logger.info(
  //     `Processing changes in page "${iri}" changed since ${date}`
  //   );
  // });
  discoverer.on('only-delete', () =>
    opts.logger.info('Refresh found; only processing delete activities')
  );

  // Fetch the changes from the remote endpoint
  await discoverer.run();

  const queueSize = await opts.queue.size();
  opts.logger.info(`Collected ${queueSize} IRIs`);
});
