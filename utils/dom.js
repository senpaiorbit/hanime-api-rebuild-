import * as cheerio from 'cheerio';

export function load(html) {
  return cheerio.load(html);
}

export function text($, selector, context = null) {
  const el = context ? $(selector, context) : $(selector);
  return el.first().text().trim() || null;
}

export function attr($, selector, attribute, context = null) {
  const el = context ? $(selector, context) : $(selector);
  return el.first().attr(attribute) || null;
}

export function each($, selector, fn) {
  const results = [];
  $(selector).each((i, el) => results.push(fn($(el), i)));
  return results;
}
