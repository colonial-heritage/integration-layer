import {ChangeDiscoverer} from './discoverer.js';
import {setupServer} from 'msw/node';
import {http, HttpResponse} from 'msw';
import {readFile} from 'node:fs/promises';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

async function readFileAsJson(fileName: string) {
  const data = await readFile(fileName, 'utf-8');
  return JSON.parse(data);
}

const server = setupServer(
  http.get(
    'http://localhost/collection-create-with-basic-auth.json',
    async ({request}) => {
      // Basic auth - base64-encoded representation of 'username' and 'password'
      const authorization = request.headers.get('Authorization');
      if (authorization !== 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=') {
        return new HttpResponse(null, {status: 401});
      }

      const data = await readFileAsJson('./fixtures/collection-create.json');
      return HttpResponse.json(data);
    }
  ),
  http.get('http://localhost/collection-add.json', async () => {
    const data = await readFileAsJson('./fixtures/collection-add.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/collection-update.json', async () => {
    const data = await readFileAsJson('./fixtures/collection-update.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/collection-delete.json', async () => {
    const data = await readFileAsJson('./fixtures/collection-delete.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/collection-refresh.json', async () => {
    const data = await readFileAsJson('./fixtures/collection-refresh.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/collection-remove.json', async () => {
    const data = await readFileAsJson('./fixtures/collection-remove.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/collection-create.json', async () => {
    const data = await readFileAsJson('./fixtures/collection-create.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/collection-move.json', async () => {
    const data = await readFileAsJson('./fixtures/collection-move.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/page-add.json', async () => {
    const data = await readFileAsJson('./fixtures/page-add.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/page-create.json', async () => {
    const data = await readFileAsJson('./fixtures/page-create.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/page-update.json', async () => {
    const data = await readFileAsJson('./fixtures/page-update.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/page-delete.json', async () => {
    const data = await readFileAsJson('./fixtures/page-delete.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/page-refresh.json', async () => {
    const data = await readFileAsJson('./fixtures/page-refresh.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/page-move.json', async () => {
    const data = await readFileAsJson('./fixtures/page-move.json');
    return HttpResponse.json(data);
  }),
  http.get('http://localhost/page-remove.json', async () => {
    const data = await readFileAsJson('./fixtures/page-remove.json');
    return HttpResponse.json(data);
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('run - with basic authentication', () => {
  it('throws if credentials are invalid', async () => {
    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-create-with-basic-auth.json',
      dateLastRun: new Date('1970-01-01'), // Arbitrary date far in the past
      credentials: {
        type: 'basic-auth',
        username: 'badUsername',
        password: 'badPassword',
      },
    });

    await expect(discoverer.run()).rejects.toThrow(
      'Response code 401 (Unauthorized)'
    );
  });

  it('runs if credentials are valid', async () => {
    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-create-with-basic-auth.json',
      dateLastRun: new Date('1970-01-01'), // Arbitrary date far in the past
      credentials: {
        type: 'basic-auth',
        username: 'username',
        password: 'password',
      },
    });

    discoverer.on('create', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource2.json');
    });

    await discoverer.run();
  });
});

describe('run - step 1', () => {
  it('terminates processing if the end time of the item is before the date of last run', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-add.json',
      dateLastRun: new Date('2017-04-10T10:00:00Z'),
    });

    discoverer.on('terminate', (endTime: Date) => {
      expect(endTime).toEqual(new Date('2017-03-10T10:00:00Z'));
    });

    await discoverer.run();
  });
});

describe('run - step 2', () => {
  it('terminates processing if a Refresh is found and the discoverer has not run before', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-refresh.json',
      dateLastRun: undefined,
    });

    discoverer.on('terminate', (startTime: Date) => {
      expect(startTime).toEqual(new Date('2020-03-10T10:00:00Z'));
    });

    await discoverer.run();
  });
});

describe('run - step 3', () => {
  it('does not re-process an already processed item', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-update.json',
      dateLastRun: new Date('2018-02-10T10:00:00Z'),
    });

    discoverer.on('processed-before', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource1.json');
    });

    await discoverer.run();
  });
});

describe('run - step 5', () => {
  it('emits a delete event if a Delete activity is found', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-delete.json',
      dateLastRun: undefined,
    });

    discoverer.on('delete', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource1.json');
    });

    await discoverer.run();
  });
});

describe('run - step 5', () => {
  it('emits a remove event if a Remove activity is found', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-remove.json',
      dateLastRun: undefined,
    });

    discoverer.on('remove', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource3.json');
    });

    await discoverer.run();
  });
});

describe('run - step 6', () => {
  it('emits a delete-only event if a Refresh activity is found and the discoverer has run before', async () => {
    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-refresh.json',
      dateLastRun: new Date('1970-01-01'), // Arbitrary date far in the past
    });

    let onlyDeleteEventHasBeenEmitted = false;
    discoverer.on('only-delete', () => (onlyDeleteEventHasBeenEmitted = true));

    await discoverer.run();

    expect(onlyDeleteEventHasBeenEmitted).toBe(true);
  });

  it('emits only a delete event if a Refresh activity is found and the discoverer has run before', async () => {
    expect.assertions(2);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-refresh.json',
      dateLastRun: new Date('1970-01-01'), // Arbitrary date far in the past
    });

    discoverer.on('delete', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource1.json');
    });

    // TODO: also check for 'remove'

    let numberOfOtherEmits = 0;
    discoverer.on('add', () => numberOfOtherEmits++);
    discoverer.on('create', () => numberOfOtherEmits++);
    discoverer.on('update', () => numberOfOtherEmits++);
    discoverer.on('move', () => numberOfOtherEmits++);

    await discoverer.run();

    expect(numberOfOtherEmits).toBe(0);
  });
});

describe('run - step 7', () => {
  it('emits a create event if a Create activity is found', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-create.json',
      dateLastRun: new Date('1970-01-01'), // Arbitrary date far in the past
    });

    discoverer.on('create', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource2.json');
    });

    await discoverer.run();
  });
});

describe('run - step 7', () => {
  it('emits an update event if an Update activity is found', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-update.json',
      dateLastRun: new Date('2018-02-10T10:00:00Z'),
    });

    discoverer.on('update', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource1.json');
    });

    await discoverer.run();
  });
});

describe('run - step 7', () => {
  it('emits an add event if an Add activity is found', async () => {
    expect.assertions(1);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-add.json',
      dateLastRun: new Date('1970-01-01'), // Arbitrary date far in the past
    });

    discoverer.on('add', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource1.json');
    });

    await discoverer.run();
  });
});

describe('run - step 8', () => {
  it('emits a move event if a Move activity is found', async () => {
    expect.assertions(2);

    const discoverer = new ChangeDiscoverer({
      collectionIri: 'http://localhost/collection-move.json',
      dateLastRun: new Date('1970-01-01'), // Arbitrary date far in the past
    });

    discoverer.on('move-delete', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource2.json');
    });
    discoverer.on('move-create', (objectIri: string) => {
      expect(objectIri).toEqual('http://localhost/resource3.json');
    });

    await discoverer.run();
  });
});
