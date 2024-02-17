import {api} from './api.js';
import {handle} from 'hono/vercel';
import {Hono} from 'hono';

export const runtime = 'edge';

const app = new Hono();
app.route('/', api);

export const GET = handle(app);
export const POST = handle(app);
