import {api} from './api.js';
import {serve} from '@hono/node-server';
import {handle} from '@hono/node-server/vercel';
import {Hono} from 'hono';
import {getRuntimeKey} from 'hono/adapter';

const app = new Hono();
app.route('/', api);

// For testing locally
if (getRuntimeKey() === 'node') {
  serve(app);
}

// For Vercel Serverless Function
export default handle(app);
