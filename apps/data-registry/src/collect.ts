import {glob} from 'glob';
import {basename} from 'node:path';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const collectRdfFilesSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  globPattern: z.string(), // E.g. 'data/**/*.ttl'
  graphBaseIri: z.string().transform(value => value.replace(/\/+$/, '')), // E.g. 'https://example.org'
});

export type CollectRdfFilesInput = z.infer<typeof collectRdfFilesSchema>;

export type FileAndGraph = {
  file: string;
  graph: string;
};

export const collectRdfFiles = fromPromise(
  async ({input}: {input: CollectRdfFilesInput}) => {
    const opts = collectRdfFilesSchema.parse(input);

    const filenames = await glob(opts.globPattern, {nodir: true});

    opts.logger.info(
      `Collecting ${filenames.length} RDF files matching "${input.globPattern}"`
    );

    const filesAndGraphs: FileAndGraph[] = filenames.map(filename => {
      const fileBasename = basename(filename);

      // Create the graph name based on the base name of the file, e.g.
      // "organizations.ttl" --> "organizations"
      const dotPosition = fileBasename.indexOf('.');
      const fileBasenameNoExtension =
        dotPosition !== -1
          ? fileBasename.substring(0, dotPosition)
          : fileBasename;

      const graph = opts.graphBaseIri + '/' + fileBasenameNoExtension;

      return {file: filename, graph};
    });

    return filesAndGraphs;
  }
);
