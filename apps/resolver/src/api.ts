import {createN2TIriFromIri} from './iri.js';
import {Hono} from 'hono';
import {env} from 'hono/adapter';

type ResolverEnv = {
  BASE_REDIRECT_URI: string;
};

export const api = new Hono();

// Disallow e.g. web crawlers (these cause massive function invocations)
api.get('/robots.txt', c => {
  return c.text(`User-agent: *
Disallow: /`);
});

api.get('/ark:/:id/*', c => {
  const resolverEnv = env<ResolverEnv>(c);
  const arkPath = createN2TIriFromIri(c.req.url);
  const location = resolverEnv.BASE_REDIRECT_URI + arkPath;

  // Hono's c.redirect() does not preserve request headers,
  // so we'll build our own response
  const headers = new Headers();

  const reqHeaders = c.req.raw.headers;
  reqHeaders.forEach((value, key) => headers.set(key, value));
  headers.set('Location', location);

  const response = new Response(null, {
    headers,
    status: 302,
  });

  return response;
});
