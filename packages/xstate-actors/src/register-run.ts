import {Runs} from '@colonial-collections/datastore';
import {SparqlChangeChecker} from '@colonial-collections/sparql-change-checker';
import {readFile} from 'node:fs/promises';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const registerRunInputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  runs: z.instanceof(Runs),
});

export type RegisterRunInput = z.input<typeof registerRunInputSchema>;

export const registerRun = fromPromise(
  async ({input}: {input: RegisterRunInput}) => {
    const opts = registerRunInputSchema.parse(input);

    opts.logger.info('Registering run');

    opts.runs.save();

    return true; // 'Must continue run'
  }
);

const registerRunAndCheckIfRunMustContinueInputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  runs: z.instanceof(Runs),
  endpointUrl: z.string().url(),
  queryFile: z.string(),
  timeout: z.number().optional(),
});

export type RegisterRunAndCheckIfRunMustContinueInput = z.input<
  typeof registerRunAndCheckIfRunMustContinueInputSchema
>;

export const registerRunAndCheckIfRunMustContinue = fromPromise(
  async ({input}: {input: RegisterRunAndCheckIfRunMustContinueInput}) => {
    const opts = registerRunAndCheckIfRunMustContinueInputSchema.parse(input);

    opts.logger.info('Registering run');

    const lastRun = await opts.runs.getLast();

    const query = await readFile(opts.queryFile, 'utf-8');
    const checker = new SparqlChangeChecker({
      endpointUrl: opts.endpointUrl,
      timeout: opts.timeout,
    });

    const response = await checker.run({
      query,
      currentIdentifier: lastRun?.identifier,
    });

    const continueRun = response.isChanged;
    opts.runs.save({identifier: response.identifier});

    opts.logger.info(
      {response},
      `Must continue run? ${continueRun ? 'Yes' : 'No'}`
    );

    return continueRun;
  }
);
