import {api} from './api.js';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {getRuntimeKey} from 'hono/adapter';
import {handle} from 'hono/vercel';

export const config = {
  runtime: 'edge',
};

const app = new Hono();
app.route('/', api);

// export const GET = handle(app);

// For local development
if (getRuntimeKey() === 'node') {
  serve(app);
}

export default handle(app);
