import {api} from './api.js';
import {describe, expect, it} from 'vitest';

describe('/robots.txt', () => {
  it('returns', async () => {
    const req = new Request('http://localhost/robots.txt', {
      method: 'GET',
    });
    const res = await api.request(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(`User-agent: *
Disallow: /`);
  });
});

describe('/ark:/', () => {
  it('redirects requests', async () => {
    const req = new Request(
      'http://localhost/ark:/27023/000074a6158155ef16efee74ea0ae0d5',
      {
        method: 'GET',
      }
    );
    const res = await api.request(req);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain(
      'https://n2t.net/ark:/27023/000074a6158155ef16efee74ea0ae0d5'
    );
  });

  it('preserves headers', async () => {
    const req = new Request(
      'http://localhost/ark:/27023/000074a6158155ef16efee74ea0ae0d5',
      {
        method: 'GET',
        headers: {
          Accept: 'text/turtle',
          'Accept-Language': 'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5',
        },
      }
    );
    const res = await api.request(req);

    expect(res.headers.get('accept')).toEqual('text/turtle');
    expect(res.headers.get('accept-language')).toEqual(
      'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5'
    );
  });
});
