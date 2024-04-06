import {md5} from './md5.js';
import {createWriteStream} from 'node:fs';
import {mkdir, rm, stat, unlink} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Stream} from '@rdfjs/types';
import rdfSerializer from 'rdf-serialize';
import {z} from 'zod';

// Required to use ESM in both TypeScript and JavaScript
const serializer = rdfSerializer.default ?? rdfSerializer;

const constructorOptionsSchema = z.object({
  dir: z.string(),
});

export type ConstructorOptions = z.input<typeof constructorOptionsSchema>;

const idSchema = z.string();
const pathSchema = z.string();

const saveOptionsSchema = z.object({
  id: idSchema,
  quadStream: z.any().refine(val => val !== undefined, {
    message: 'quadStream must be defined',
  }),
});

// Duplication of 'saveOptionsSchema' because we cannot set the type of 'quadStream' there
export type SaveOptions = {
  id: string;
  quadStream: Stream;
};

export class Filestore {
  private readonly dir: string;
  private static readonly fileExtension = '.nt'; // N-Triples

  constructor(options: ConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.dir = resolve(opts.dir);
  }

  createHashFromId(id: string) {
    return md5(id);
  }

  createPathFromId(id: string) {
    idSchema.parse(id);

    const hashOfId = this.createHashFromId(id);
    const filename = hashOfId + Filestore.fileExtension;

    // A large number of files in a single directory can slow down file access;
    // create a multi-level directory hierarchy instead by using the last characters
    // of the filename's hash (similar to the file caching strategy of Nginx)
    const subDir1 = hashOfId.substring(hashOfId.length - 1);
    const subDir2 = hashOfId.substring(
      hashOfId.length - 2,
      hashOfId.length - 1
    );
    const path = join(this.dir, subDir1, subDir2, filename);

    return path;
  }

  private async removeByPath(path: string) {
    pathSchema.parse(path);

    try {
      await unlink(path);
    } catch (err) {
      const error = err as Error;
      const isFileNotFoundError = error.message.includes('ENOENT');
      if (!isFileNotFoundError) {
        throw err;
      }
    }
  }

  async removeById(id: string) {
    idSchema.parse(id);

    const path = this.createPathFromId(id);

    return this.removeByPath(path);
  }

  async removeAll() {
    await rm(this.dir, {recursive: true, force: true});
  }

  async save(options: SaveOptions) {
    const opts = saveOptionsSchema.parse(options);

    const path = this.createPathFromId(opts.id);
    await mkdir(dirname(path), {recursive: true});
    const writeStream = createWriteStream(path); // Overwrite an existing file, if any
    const dataStream = serializer.serialize(opts.quadStream, {path});
    await pipeline(dataStream, writeStream);

    // Remove empty file - the quad stream was probably empty
    const stats = await stat(path);
    if (stats.size === 0) {
      await this.removeByPath(path);
    }
  }
}
