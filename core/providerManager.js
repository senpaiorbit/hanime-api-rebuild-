import * as anikai from '../providers/anikai/index.js';
import { config } from './config.js';

// Only import providers that actually exist.
// Add new providers here once their folder is implemented.
const providers = {
  anikai,
};

// Lazy-load map for providers not yet statically imported.
// When hianime is implemented, move it to the static imports above.
const lazyProviders = {
  hianime: () => import('../providers/hianime/index.js'),
};

export async function getProvider(name) {
  const key = name || config.defaultProvider;

  if (providers[key]) return providers[key];

  if (lazyProviders[key]) {
    try {
      const mod = await lazyProviders[key]();
      providers[key] = mod;
      return providers[key];
    } catch {
      throw new Error(`Provider "${key}" is not yet implemented.`);
    }
  }

  throw new Error(`Provider "${key}" not found. Available: ${Object.keys(providers).join(', ')}`);
}

export async function getProviderWithFallback(name) {
  const order = name
    ? [name]
    : [config.defaultProvider, ...Object.keys(providers).filter(p => p !== config.defaultProvider)];

  for (const key of order) {
    try {
      return { provider: await getProvider(key), name: key };
    } catch {
      continue;
    }
  }
  throw new Error('No providers available');
}

export function listProviders() {
  return [...Object.keys(providers), ...Object.keys(lazyProviders)];
}
