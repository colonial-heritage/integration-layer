import {Buffer} from 'node:buffer';
import {EventEmitter} from 'node:events';
import pRetry from 'p-retry';
import rdfDereferencer, {IDereferenceOptions} from 'rdf-dereference';
import {z} from 'zod';

// Required to use ESM in both TypeScript and JavaScript
const dereferencer = rdfDereferencer.default ?? rdfDereferencer;

const constructorOptionsSchema = z
  .object({
    credentials: z
      .object({
        type: z.literal('basic-auth'), // Only supported type at this moment
        username: z.string(),
        password: z.string(),
      })
      .optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .default({});

export type ConstructorOptions = z.input<typeof constructorOptionsSchema>;

export class Dereferencer extends EventEmitter {
  private readonly dereferenceOptions: IDereferenceOptions;

  constructor(options?: ConstructorOptions) {
    super();

    const opts = constructorOptionsSchema.parse(options);

    this.dereferenceOptions = this.getDereferenceOptions(opts);
  }

  private createBasicAuthHeader(username: string, password: string) {
    const authValue = `${username}:${password}`;
    const authValueBase64 = Buffer.from(authValue).toString('base64');
    const headerValue = `Basic ${authValueBase64}`;

    return headerValue;
  }

  // TBD: create dereference options per IRI domain, so that the dereferencer
  // can make calls to various domains, each having their own options?
  private getDereferenceOptions(options: ConstructorOptions) {
    const dereferenceOptions: IDereferenceOptions = {};
    const headers: Record<string, string> = {};

    if (options?.headers !== undefined) {
      Object.assign(headers, options.headers);
    }

    if (options?.credentials !== undefined) {
      headers.Authorization = this.createBasicAuthHeader(
        options.credentials.username,
        options.credentials.password
      );
    }

    if (Object.entries(headers).length > 0) {
      dereferenceOptions.headers = headers;
    }

    return dereferenceOptions;
  }

  async getResource(iri: string) {
    const run = async () =>
      dereferencer.dereference(iri, this.dereferenceOptions);

    const response = await pRetry(run, {
      retries: 3,
      onFailedAttempt: err => {
        const prettyError = new Error(
          `Failed to dereference "${iri}": ${err.message}`
        );
        prettyError.stack = err.stack;
        this.emit('warning', prettyError);
      },
    });

    const quadStream = response.data;

    return quadStream;
  }
}
