import axios from 'axios';
import { config } from '../core/config.js';

const client = axios.create({
  timeout: config.timeout,
  headers: config.headers,
});

export async function get(url, options = {}) {
  const res = await client.get(url, options);
  return res.data;
}
