import { Hono } from 'hono';
import { getProvider } from '../core/providerManager.js';

const app = new Hono();

app.get('/', (c) => c.json({ status: 'ok', message: 'Anime Scraping API' }));

app.get('/anime/:id', async (c) => {
  const { id } = c.req.param();
  const providerName = c.req.query('provider');
  const provider = getProvider(providerName);
  const data = await provider.anime.getById(id);
  return c.json(data);
});

app.get('/search', async (c) => {
  const query = c.req.query('q');
  const providerName = c.req.query('provider');
  const provider = getProvider(providerName);
  const data = await provider.search.query(query);
  return c.json(data);
});

export default app;
