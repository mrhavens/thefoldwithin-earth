#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
const ROOT = "public";
const OUT = path.join(ROOT, "index.json");
const STATIC_TOPLEVEL = new Set(["about", "contact", "legal"]);
const MAX_BYTES = 64 * 1024;

function dateFromName(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? new Date(m[0]).getTime() : null;
}
async function readHead(abs) {
  const fh = await fs.open(abs, "r");
  const buf = Buffer.alloc(MAX_BYTES);
  const { bytesRead } = await fh.read(buf, 0, MAX_BYTES, 0);
  await fh.close();
  return buf.slice(0, bytesRead).toString("utf8");
}
function parseTitle(raw, ext) {
  if (ext === ".md") return raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1].trim();
  if (ext === ".html") return raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1].trim();
  return null;
}

async function walk(relBase = "") {
  const abs = path.join