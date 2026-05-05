import * as hianime from '../providers/hianime/index.js';
import { config } from './config.js';

const providers = {
  hianime,
};

export function getProvider(name) {
  const key = name || config.defaultProvider;
  const provider = providers[key];
  if (!provider) throw new Error(`Provider "${key}" not found`);
  return provider;
}

export function listProviders() {
  return Object.keys(providers);
}
