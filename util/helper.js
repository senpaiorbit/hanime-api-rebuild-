// ─── Helper Utilities ─────────────────────────────────────────────────────────
import { CONFIG } from "../config/config.js";

export async function fetchPage(url, ajax = false) {
  const headers = ajax ? CONFIG.AJAX_HEADERS : CONFIG.REQUEST_HEADERS;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Fetch failed [${res.status}]: ${url}`);
  }
  return res.text();
}

export async function fetchJSON(url) {
  const res = await fetch(url, { headers: CONFIG.AJAX_HEADERS });
  if (!res.ok) throw new Error(`Fetch failed [${res.status}]: ${url}`);
  return res.json();
}

export function extractId(href = "") {
  return href.replace(/^.*\/(anime|watch)\//, "").split("?")[0].trim();
}

export function extractWatchId(href = "") {
  return href.replace(/^.*\/watch\//, "").split("?")[0].trim();
}

export function intParam(val, fallback = 1) {
  const n = parseInt(val, 10);
  return isNaN(n) || n < 1 ? fallback : n;
}

export function clean(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

export function errorResponse(message, status = 500) {
  return Response.json(
    { status, error: message,  null },
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}

export function jsonResponse(data, ttl = 0) {
  const cacheHeader =
    ttl > 0
      ? `public, s-maxage=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`
      : "no-store";
      
  return Response.json(
    { status: 200, data },
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

export function parseTicks($el, $) {
  const sub  = parseInt($el.find(".tick-sub").text().trim(), 10)  || null;
  const dub  = parseInt($el.find(".tick-dub").text().trim(), 10)  || null;
  const raw  = parseInt($el.find(".tick-eps").text().trim(), 10)  || null;
  return { sub, dub, raw };
}

export function safeDate(dateStr = "") {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return dateStr;
}
