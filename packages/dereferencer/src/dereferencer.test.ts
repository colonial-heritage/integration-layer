import {Dereferencer} from './dereferencer.js';
import getStream from 'get-stream';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {readFile} from 'node:fs/promises';
import {Stream} from '@rdfjs/types';
import rdfSerializer from 'rdf-serialize';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

// Required to use ESM in both TypeScript and JavaScript
const serializer = rdfSerializer.default ?? rdfSerializer;

const server = setupServer(
  http.get(
    'http://localhost/resource-with-basic-auth.ttl',
    async ({request}) => {
      // Basic auth - base64-encoded representation of 'username' and 'password'
      const authorization = request.headers.get('Authorization');
      if (authorization !== 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=') {
        return new HttpResponse(null, {status: 401});
      }

      const data = await readFile('./fixtures/resource.ttl', 'utf-8');
      return new HttpResponse(data, {headers: {'Content-Type': 'text/turtle'}});
    }
  ),
  http.get(
    'http://localhost/resource-with-accept-header.ttl',
    async ({request}) => {
      // Simple string check, just for the test. The actual Accept header send by the client
      // is much richer (e.g. "application/n-quads,application/trig;q=0.95")
      const accept = request.headers.get('Accept');
      if (!accept?.startsWith('text/turtle')) {
        return new HttpResponse(null, {status: 406});
      }

      const data = await readFile('./fixtures/resource.ttl', 'utf-8');
      return new HttpResponse(data, {headers: {'Content-Type': 'text/turtle'}});
    }
  ),
  http.get('http://localhost/resource.ttl', async () => {
    const data = await readFile('./fixtures/resource.ttl', 'utf-8');
    return new HttpResponse(data, {headers: {'Content-Type': 'text/turtle'}});
  }),
  http.get(
    'http://localhost/error.ttl',
    async () => new HttpResponse(null, {status: 500})
  )
);

async function expectStreamToMatch(quadStream: Stream) {
  const dataStream = serializer.serialize(quadStream, {
    contentType: 'application/n-triples',
  });
  const result = await getStream(dataStream);

  expect(result).toEqual(
    `<http://localhost/resource1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://schema.org/CreativeWork> .
`
  );
}

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('getResource', () => {
  it('throws if resource could not be dereferenced', async () => {
    expect.assertions(5); // Including retries

    const dereferencer = new Dereferencer();

    dereferencer.on('warning', (err: Error) => {
      expect(err.message).toBe(
        `Failed to dereference "http://localhost/error.ttl": Could not retrieve http://localhost/error.ttl (HTTP status 500):
empty response`
      );
    });

    try {
      await dereferencer.getResource('http://localhost/error.ttl');
    } catch (err) {
      const error = err as Error;
      expect(error.message).toEqual(
        `Could not retrieve http://localhost/error.ttl (HTTP status 500):
empty response`
      );
    }
  });

  it('dereferences a resource', async () => {
    const dereferencer = new Dereferencer();

    const quadStream = await dereferencer.getResource(
      'http://localhost/resource.ttl'
    );

    await expectStreamToMatch(quadStream);
  });
});

describe('getResource - with basic authentication', () => {
  it('throws if credentials are invalid', async () => {
    expect.assertions(1);

    const dereferencer = new Dereferencer({
      credentials: {
        type: 'basic-auth',
        username: 'badUsername',
        password: 'badPassword',
      },
    });

    try {
      await dereferencer.getResource(
        'http://localhost/resource-with-basic-auth.ttl'
      );
    } catch (err) {
      const error = err as Error;
      expect(error.message).toEqual(
        `Could not retrieve http://localhost/resource-with-basic-auth.ttl (HTTP status 401):
empty response`
      );
    }
  });

  it('dereferences a resource if credentials are valid', async () => {
    const dereferencer = new Dereferencer({
      credentials: {
        type: 'basic-auth',
        username: 'username',
        password: 'password',
      },
    });

    const quadStream = await dereferencer.getResource(
      'http://localhost/resource-with-basic-auth.ttl'
    );

    await expectStreamToMatch(quadStream);
  });
});

describe('getResource - with headers', () => {
  it('throws if HTTP header is invalid when dereferencing', async () => {
    expect.assertions(1);

    const dereferencer = new Dereferencer({
      headers: {
        Accept: 'bad/value',
      },
    });

    try {
      await dereferencer.getResource(
        'http://localhost/resource-with-accept-header.ttl'
      );
    } catch (err) {
      const error = err as Error;
      expect(error.message).toEqual(
        `Could not retrieve http://localhost/resource-with-accept-header.ttl (HTTP status 406):
empty response`
      );
    }
  });

  it('dereferences a resource if HTTP header is valid', async () => {
    const dereferencer = new Dereferencer({
      headers: {
        Accept: 'text/turtle',
      },
    });

    const quadStream = await dereferencer.getResource(
      'http://localhost/resource-with-accept-header.ttl'
    );

    await expectStreamToMatch(quadStream);
  });
});
