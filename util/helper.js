// ─── Helper Utilities ─────────────────────────────────────────────────────────
// Uses axios for all HTTP requests — better error messages, automatic JSON
// parsing, configurable timeouts, and consistent response handling.

import axios from "axios";
import { CONFIG } from "../config/config.js";

// ── Shared axios instance ──────────────────────────────────────────────────────

const http = axios.create({
  timeout: 20000,
  validateStatus: (s) => s < 400, // treat 4xx/5xx as errors
});

/**
 * Fetch a full HTML page with browser-like headers.
 * Used for /anime/:slug, /watch/:slug, and any full-document endpoint.
 */
export async function fetchPage(url, headers = CONFIG.REQUEST_HEADERS) {
  const res = await http.get(url, {
    headers,
    responseType: "text",
  });
  return res.data;
}

/**
 * Fetch an endpoint that returns either:
 *   • JSON: { html: "…" } or { status: true, html: "…" }
 *   • Raw HTML string
 *
 * Returns the inner HTML string ready for Cheerio.
 * This is the server-side scraping replacement for client-side jQuery.ajax.
 */
export async function fetchHTML(url, headers = CONFIG.AJAX_HEADERS) {
  const res = await http.get(url, { headers });
  const data = res.data;

  // axios already auto-parses JSON responses
  if (data && typeof data === "object") {
    return data.html || data.content || "";
  }

  // Raw HTML response
  return String(data);
}

/**
 * Fetch JSON from an endpoint and return the parsed object.
 * Used for structured endpoints (episode sources, etc.).
 */
export async function fetchJSON(url, headers = CONFIG.AJAX_HEADERS) {
  const res = await http.get(url, { headers });
  return res.data;
}

/**
 * Extract the anime slug-id from a full hianime URL or relative href.
 * e.g. "/anime/bleach-yaa9n" → "bleach-yaa9n"
 */
export function extractId(href = "") {
  return href.replace(/^.*\/(anime|watch)\//, "").split("?")[0].trim();
}

/**
 * Extract only the slug portion from a watch URL with episode query.
 * e.g. "/watch/bleach-yaa9n?ep=1" → "bleach-yaa9n"
 */
export function extractWatchId(href = "") {
  return href.replace(/^.*\/watch\//, "").split("?")[0].trim();
}

/**
 * Parse an integer query param, with a fallback default.
 */
export function intParam(val, fallback = 1) {
  const n = parseInt(val, 10);
  return isNaN(n) || n < 1 ? fallback : n;
}

/**
 * Sanitise a string from the DOM — trims whitespace, collapses internal spaces.
 */
export function clean(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Build a standard JSON error response.
 */
export function errorResponse(message, status = 500) {
  return Response.json(
    { success: false, data: null, error: message },
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/**
 * Build a standard success JSON response with optional CDN caching.
 * @param {*} data     - the payload
 * @param {number} ttl - Cache-Control max-age in seconds (0 = no-store)
 */
export function jsonResponse(data, ttl = 0) {
  const cacheHeader =
    ttl > 0
      ? `public, s-maxage=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`
      : "no-store";

  return Response.json(
    { success: true, ...data },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": cacheHeader,
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/**
 * Parse the tick counts (sub/dub/eps episode counts) from a film card element.
 * Strips icon children before reading text.
 */
export function parseTicks($el, $) {
  const getText = (sel) => {
    const num = parseInt(
      $el.find(sel).clone().children().remove().end().text().replace(/\D/g, ""),
      10
    );
    return isNaN(num) ? null : num;
  };
  return {
    sub: getText(".tick-sub"),
    dub: getText(".tick-dub"),
    raw: getText(".tick-eps"),
  };
}

/**
 * Validate and sanitise a date string (YYYY-MM-DD).
 * Returns today's date string if input is invalid.
 */
export function safeDate(dateStr = "") {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return dateStr;
}
