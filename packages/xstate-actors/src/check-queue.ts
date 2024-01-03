import {Queue} from '@colonial-collections/datastore';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  queue: z.instanceof(Queue),
  type: z.string().optional(),
});

export type CheckQueueInput = z.input<typeof inputSchema>;

export const checkQueue = fromPromise(
  async ({input}: {input: CheckQueueInput}) => {
    const opts = inputSchema.parse(input);

    return opts.queue.size({type: opts.type});
  }
);
