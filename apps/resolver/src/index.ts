import {api} from './api.js';
import {serve} from '@hono/node-server';
import {handle} from '@hono/node-server/vercel';
import {Hono} from 'hono';

const app = new Hono();
app.route('/', api);

// For local development
if (process.env.NODE_ENV === 'development') {
  serve(app);
}

// For Vercel Serverless Function
export default handle(app);
