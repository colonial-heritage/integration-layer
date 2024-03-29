import {getRdfFiles} from './glob.js';
import {mkdir, readFile, stat, unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {pino} from 'pino';
import tar from 'tar';
import App from '@triply/triplydb';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  logger: z.any(),
  instanceUrl: z.string(),
  apiToken: z.string(),
  account: z.string(),
  dataset: z.string(),
});

export type ConstructorOptions = z.infer<typeof constructorOptionsSchema>;

const upsertGraphFromFileOptionsSchema = z.object({
  file: z.string(),
  graph: z.string(),
});

export type UpsertGraphFromFileOptions = z.infer<
  typeof upsertGraphFromFileOptionsSchema
>;

const upsertGraphFromDirectoryOptionsSchema = z.object({
  dir: z.string(),
  graph: z.string(),
  dirTemp: z.string().optional(), // For storing temporary files
});

export type UpsertGraphFromDirectoryOptions = z.infer<
  typeof upsertGraphFromDirectoryOptionsSchema
>;

const restartServiceOptionsSchema = z.object({
  name: z.string(),
  templatesFile: z.string().optional(), // For Elasticsearch
});

export type RestartServiceOptions = z.infer<typeof restartServiceOptionsSchema>;

export class TriplyDb {
  private readonly logger: pino.Logger;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dataset: any; // Triply package doesn't export a type

  private constructor(options: ConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.logger = opts.logger;
  }

  private async init(options: ConstructorOptions) {
    const triplyDb = App.get({
      token: options.apiToken,
      url: options.instanceUrl,
    });
    const account = await triplyDb.getAccount(options.account);
    this.dataset = await account.getDataset(options.dataset);
  }

  static async new(options: ConstructorOptions) {
    const triplyDb = new TriplyDb(options);
    await triplyDb.init(options);

    return triplyDb;
  }

  async upsertGraphFromFile(options: UpsertGraphFromFileOptions) {
    const opts = upsertGraphFromFileOptionsSchema.parse(options);

    const stats = await stat(opts.file);
    if (stats.size === 0) {
      this.logger.warn(
        `Cannot add file "${opts.file}" to graph "${opts.graph}": file is empty`
      );
      return;
    }

    this.logger.info(`Deleting graph "${opts.graph}"`);

    try {
      await this.dataset.deleteGraph(opts.graph);
    } catch (err) {
      const error = err as Error;
      if (
        !error.message.includes(`Graph '${opts.graph}' not found in dataset`)
      ) {
        throw err;
      }
    }

    this.logger.info(`Adding file "${opts.file}" to graph "${opts.graph}"`);

    await this.dataset.importFromFiles([opts.file], {
      defaultGraphName: opts.graph,
    });
  }

  async upsertGraphFromDirectory(options: UpsertGraphFromDirectoryOptions) {
    const opts = upsertGraphFromDirectoryOptionsSchema.parse(options);

    const filenames = await getRdfFiles(opts.dir);
    if (filenames.length === 0) {
      this.logger.warn(`No files found in "${opts.dir}"`);
      return;
    }

    const dirTemp = opts.dirTemp ?? tmpdir();
    await mkdir(dirTemp, {recursive: true});
    const tarFilename = join(dirTemp, `${Date.now()}.tgz`);

    this.logger.info(
      `Creating "${tarFilename}" with ${filenames.length} files from "${opts.dir}"`
    );

    const logWarning = (code: string, message: string) => {
      // Don't output informative warnings - these can flood the logs
      if (code !== 'TAR_ENTRY_INFO') {
        this.logger.warn(`${message} (code: ${code})`);
      }
    };

    await tar.create(
      {gzip: true, onwarn: logWarning, file: tarFilename},
      filenames
    );
    await this.upsertGraphFromFile({file: tarFilename, graph: opts.graph});
    await unlink(tarFilename);
  }

  async restartService(options: RestartServiceOptions) {
    const opts = restartServiceOptionsSchema.parse(options);

    let templates;
    if (opts.templatesFile !== undefined) {
      const rawData = await readFile(opts.templatesFile, 'utf-8');
      templates = JSON.parse(rawData);
    }

    this.logger.info('Creating new service');

    // Waits until running
    const newService = await this.dataset.addService(
      `tmp-service-${Date.now()}`, // Random, unique name
      templates
    );

    let oldService;
    try {
      oldService = await this.dataset.getService(opts.name);
      await oldService.rename(`tmp-service-${Date.now()}`); // Random, unique name
    } catch (err) {
      const error = err as Error;
      if (!error.message.includes('It does not exist')) {
        throw err;
      }
    }

    await newService.rename(opts.name);

    try {
      if (oldService !== undefined) {
        this.logger.info('Deleting old service');
        await oldService.delete();
      }
    } catch (err) {
      this.logger.error(err, 'Failed to delete old service');
    }
  }
}
