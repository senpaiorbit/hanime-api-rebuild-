import * as cheerio from 'cheerio';

export function load(html) {
  return cheerio.load(html);
}

export function text($, selector, ctx = null) {
  const el = ctx ? $(selector, ctx) : $(selector);
  return el.first().text().trim() || null;
}

export function attr($, selector, attribute, ctx = null) {
  const el = ctx ? $(selector, ctx) : $(selector);
  return el.first().attr(attribute) || null;
}

export function each($, selector, fn) {
  const results = [];
  $(selector).each((i, el) => results.push(fn($(el), i)));
  return results;
}

export function num(str) {
  const n = parseInt(str?.trim(), 10);
  return isNaN(n) ? null : n;
}

export function lastPage($) {
  // grab last page number from pagination
  const last = $('nav .pagination .page-item:last-child a, nav .pagination li:last-child a').attr('href');
  if (!last) {
    const active = $('nav .pagination .page-item.active .page-link').text().trim();
    return num(active) || 1;
  }
  const match = last.match(/page=(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

export function currentPage($) {
  return num($('nav .pagination .page-item.active .page-link').text().trim()) || 1;
}
