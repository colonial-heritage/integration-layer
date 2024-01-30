import {Queue} from '@colonial-collections/datastore';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  queue: z.instanceof(Queue),
  type: z.string().optional(),
});

export type GetQueueSizeInput = z.input<typeof inputSchema>;

export const getQueueSize = fromPromise(
  async ({input}: {input: GetQueueSizeInput}) => {
    const opts = inputSchema.parse(input);

    return opts.queue.size({type: opts.type});
  }
);
