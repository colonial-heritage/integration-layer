import {api} from './api.js';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';

const app = new Hono();
app.route('/', api);

serve(app);
