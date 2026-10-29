import * as crypto from 'crypto';
import { prisma } from '../db/prisma';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── VidNest (Megaplay / Aniwave / Anitaku / AnimePahe) ─────────────────────
const VIDNEST_SECRET = 'K3p8vQ2mX9rL5wZ0fN7bG1sH4tJ6dC9_y8S3wM1nQ5pL2';
const VIDNEST_BASE = 'https://new.vidnest.fun';

// ─── ZokoAnime ──────────────────────────────────────────────────────────────
const ZOKO_XOR_KEY = 'otaku-embed-v1';

// ─── Server definitions ─────────────────────────────────────────────────────
export interface ServerEntry {
  name: string;
  id: string;
  type: string;
}

export const AVAILABLE_SERVERS: ServerEntry[] = [
  { name: 'HD-1', id: 'megaplay', type: 'megaplay' },
  { name: 'HD-2', id: 'zokoanime', type: 'zokoanime' },
  { name: 'HD-3', id: 'animepahe', type: 'animepahe' },
  { name: 'HD-4', id: 'aniwave', type: 'aniwave' },
  { name: 'HD-5', id: 'anitaku', type: 'anitaku' },
];

export interface StreamSource {
  url: string;
  proxiedUrl?: string;
  quality: string;
  type: string;
}

export interface StreamSubtitle {
  url: string;
  proxiedUrl?: string;
  lang: string;
  label: string;
}

export interface StreamResult {
  server: string;
  sources: StreamSource[];
  subtitles: StreamSubtitle[];
  thumbnails: string | null;
  proxiedThumbnails?: string | null;
  headers: Record<string, string>;
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
}

// ─── Proxy URL Builder ───────────────────────────────────────────────────────
const UPCLOUD_PROXY_BASE = 'https://upcloud.animanga.fun/proxy';

/**
 * Builds a universal proxied URL via upcloud.animanga.fun/proxy with headers.
 */
export function buildProxiedUrl(targetUrl: string, headers: Record<string, string>): string {
  if (!targetUrl) return '';
  const searchParams = new URLSearchParams();
  searchParams.set('url', targetUrl);
  searchParams.set('headers', JSON.stringify(headers));
  return `${UPCLOUD_PROXY_BASE}?${searchParams.toString()}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve anilist_id and mal_id from anisora_id in the database.
 */
export async function resolveIds(anisoraIdInput: string | number | bigint) {
  const anisoraId = BigInt(anisoraIdInput);

  const anime = await prisma.anime.findUnique({
    where: { anisora_id: anisoraId },
    select: {
      anisora_id: true,
      anilist_id: true,
      mal_id: true,
      title: true,
      default_name: { select: { name: true } },
    },
  });

  if (!anime) {
    throw new Error(`Anime with Anisora ID ${anisoraId} not found in database.`);
  }

  return {
    anisoraId: anisoraId.toString(),
    anilistId: anime.anilist_id ? Number(anime.anilist_id) : null,
    malId: anime.mal_id ? Number(anime.mal_id) : null,
    title: anime.default_name?.name || anime.title,
  };
}

/**
 * Generate random base64url nonce (16 bytes).
 */
function makeNonce(): string {
  return crypto
    .randomBytes(16)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decrypt VidNest AES-256-GCM encrypted response.
 * Response format: { v: 2, d: "<base64url ciphertext>", n: "<nonce>" }
 */
function decryptVidnest(encryptedData: string, nonce: string): any {
  // Derive key: SHA-256(nonce + "|" + secret)
  const keyHash = crypto
    .createHash('sha256')
    .update(`${nonce}|${VIDNEST_SECRET}`, 'utf8')
    .digest();

  // Base64url decode the ciphertext payload
  const buffer = Buffer.from(encryptedData, 'base64url');
  const iv = buffer.subarray(0, 12);
  const ciphertextAndTag = buffer.subarray(12);

  // Last 16 bytes = AES-GCM authentication tag
  const tag = ciphertextAndTag.subarray(ciphertextAndTag.length - 16);
  const ciphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyHash, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const text = decrypted.toString('utf8');

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * XOR deobfuscation for ZokoAnime's window.__P payload.
 */
function zokoXor(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ ZOKO_XOR_KEY.charCodeAt(i % ZOKO_XOR_KEY.length));
  }
  return out;
}

function zokoDeobfuscate(blob: string): any {
  const raw = Buffer.from(blob, 'base64').toString('binary');
  const xored = zokoXor(raw);
  const decoded = decodeURIComponent(escape(xored));
  return JSON.parse(decoded);
}

// ─── VidNest provider fetch ─────────────────────────────────────────────────

/**
 * Build VidNest API path per server type.
 */
function vidnestPath(server: string, anilistId: number, episode: number, subDub: string): string {
  switch (server) {
    case 'megaplay':
      return `/animehub/${anilistId}/${episode}/${subDub}`;
    case 'aniwave':
      return `/aniwave_hls/${anilistId}/${episode}/${subDub}`;
    case 'anitaku':
      return `/hianime/anime/${anilistId}/${episode}/${subDub}/hd-2`;
    case 'animepahe':
      return `/animepahe/${anilistId}/${episode}/${subDub}`;
    default:
      throw new Error(`Unknown VidNest server: ${server}`);
  }
}

/**
 * Fetch and decrypt from VidNest (covers megaplay, aniwave, anitaku, animepahe).
 */
async function fetchVidnest(
  server: string,
  anilistId: number,
  episode: number,
  subDub: string
): Promise<StreamResult> {
  const apiPath = vidnestPath(server, anilistId, episode, subDub);
  const nonce = makeNonce();
  const url = `${VIDNEST_BASE}${apiPath}?_n=${encodeURIComponent(nonce)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://vidnest.fun/',
    },
  });

  if (!res.ok) {
    if (server === 'animepahe' && (res.status === 502 || res.status === 503 || res.status === 504)) {
      throw new Error(
        `AnimePahe upstream server is temporarily unavailable (HTTP ${res.status}). Please choose another server (e.g. megaplay, zokoanime, or aniwave).`
      );
    }
    throw new Error(`VidNest ${server} returned ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as any;

  let data: any;
  if (json.v === 2 && json.d && json.n) {
    data = decryptVidnest(json.d, json.n);
  } else {
    // Fallback: may already be plain JSON
    data = json;
  }

  // Normalize sources & subtitles (different servers use different field names)
  const rawSources: any[] = data.sources || data.multiSrc || [];
  const rawSubs: any[] = data.subtitles || data.tracks || [];

  const sources: StreamSource[] = rawSources.map((s: any) => ({
    url: s.url || s.file || '',
    quality: s.quality || s.label || 'auto',
    type: s.type || 'hls',
  }));

  const subtitles: StreamSubtitle[] = rawSubs
    .filter((t: any) => ((t.kind || 'captions') === 'captions' || t.label) && (t.url || t.file || t.src))
    .map((t: any) => {
      const subUrl = t.url || t.file || t.src || '';
      return {
        url: subUrl,
        lang: t.srclang || t.lang || 'en',
        label: t.label || t.name || 'Unknown',
      };
    });

  // Thumbnails (some servers include a thumbnail/sprite track)
  const thumbTrack = rawSubs.find((t: any) => t.kind === 'thumbnails');
  const thumbnails = thumbTrack?.url || thumbTrack?.file || thumbTrack?.src || null;

  // Intro / outro skip times
  const intro = data.intro && typeof data.intro.start === 'number'
    ? { start: data.intro.start, end: data.intro.end }
    : null;
  const outro = data.outro && typeof data.outro.start === 'number'
    ? { start: data.outro.start, end: data.outro.end }
    : null;

  // Server-specific headers the client should send when requesting the m3u8
  const headers = buildHeaders(server, rawSources[0]);

  // Attach proxiedUrl to each source and subtitle
  for (const s of sources) {
    if (s.url) {
      s.proxiedUrl = buildProxiedUrl(s.url, headers);
    }
  }

  for (const sub of subtitles) {
    if (sub.url) {
      sub.proxiedUrl = buildProxiedUrl(sub.url, headers);
    }
  }

  const proxiedThumbnails = thumbnails ? buildProxiedUrl(thumbnails, headers) : null;

  return { server, sources, subtitles, thumbnails, proxiedThumbnails, headers, intro, outro };
}

// ─── ZokoAnime fetch ────────────────────────────────────────────────────────

async function fetchZoko(
  malId: number,
  episode: number,
  subDub: string
): Promise<StreamResult> {
  const url = `https://zokoanime.video/stream/mal/${malId}/${episode}/${subDub}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`ZokoAnime returned ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const match = html.match(/window\.__P\s*=\s*"([^"]+)"/);

  if (!match) {
    throw new Error('ZokoAnime: window.__P payload not found in HTML');
  }

  const data = zokoDeobfuscate(match[1]);

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
  };

  const sources: StreamSource[] = [];
  if (data.src) {
    sources.push({
      url: data.src,
      proxiedUrl: buildProxiedUrl(data.src, headers),
      quality: 'auto',
      type: 'hls',
    });
  }

  const subtitles: StreamSubtitle[] = (data.subtitles || [])
    .filter((s: any) => Boolean(s.src || s.url || s.file))
    .map((s: any) => {
      const subUrl = s.src || s.url || s.file || '';
      return {
        url: subUrl,
        proxiedUrl: subUrl ? buildProxiedUrl(subUrl, headers) : undefined,
        lang: s.lang || s.srclang || 'en',
        label: s.label || 'English',
      };
    });

  const thumbnails = data.poster || null;
  const proxiedThumbnails = thumbnails ? buildProxiedUrl(thumbnails, headers) : null;
  const intro = data.skip?.intro
    ? { start: data.skip.intro.start, end: data.skip.intro.end }
    : null;
  const outro = data.skip?.outro
    ? { start: data.skip.outro.start, end: data.skip.outro.end }
    : null;

  return {
    server: 'zokoanime',
    sources,
    subtitles,
    thumbnails,
    proxiedThumbnails,
    headers,
    intro,
    outro,
  };
}

// ─── Header builder ─────────────────────────────────────────────────────────

function buildHeaders(server: string, source?: any): Record<string, string> {
  const base: Record<string, string> = { 'User-Agent': USER_AGENT };

  switch (server) {
    case 'megaplay':
      if (source?.referer) {
        base['Referer'] = source.referer;
        try {
          base['Origin'] = new URL(source.referer).origin;
        } catch { /* ignore */ }
      } else {
        base['Referer'] = 'https://megaplay.buzz/';
        base['Origin'] = 'https://megaplay.buzz';
      }
      break;

    case 'aniwave':
      base['Referer'] = 'https://play.echovideo.ru/';
      base['Origin'] = 'https://play.echovideo.ru';
      break;

    case 'anitaku':
      base['Referer'] = 'https://megaplay.buzz/';
      base['Origin'] = 'https://megaplay.buzz';
      break;

    case 'animepahe':
      base['Referer'] = 'https://animepahe.ru/';
      base['Origin'] = 'https://animepahe.ru';
      break;

    case 'zokoanime':
      // Direct m3u8 — no special headers needed
      break;
  }

  return base;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export class StreamService {
  /**
   * List available streaming servers for a given anime episode.
   */
  static getServers(): ServerEntry[] {
    return AVAILABLE_SERVERS;
  }

  /**
   * Extract streaming link from specified server.
   */
  static async getStream(
    anisoraId: string | number | bigint,
    episode: number,
    server: string,
    subDub: 'sub' | 'dub' = 'sub'
  ): Promise<StreamResult> {
    const ids = await resolveIds(anisoraId);

    if (server === 'zokoanime') {
      if (!ids.malId) {
        throw new Error(
          `ZokoAnime requires mal_id — anime '${ids.title}' has no MyAnimeList ID mapped.`
        );
      }
      return fetchZoko(ids.malId, episode, subDub);
    }

    // All other servers go through VidNest (needs anilist_id)
    if (!ids.anilistId) {
      throw new Error(
        `Server '${server}' requires anilist_id — anime '${ids.title}' has no AniList ID mapped.`
      );
    }

    let result: StreamResult;

    if (server === 'animepahe') {
      // VidNest's /animepahe/ route on the frontend automatically falls back to:
      // ["anitaku", "aniwave", "megaplay"]
      try {
        result = await fetchVidnest('animepahe', ids.anilistId, episode, subDub);
      } catch (err: any) {
        let fallbackResult: StreamResult | null = null;
        for (const fallbackServer of ['anitaku', 'megaplay', 'aniwave']) {
          try {
            fallbackResult = await fetchVidnest(fallbackServer, ids.anilistId, episode, subDub);
            break;
          } catch {
            // continue fallback
          }
        }
        if (!fallbackResult) throw err;
        result = {
          ...fallbackResult,
          server: 'animepahe',
        };
      }
    } else {
      result = await fetchVidnest(server, ids.anilistId, episode, subDub);
    }

    // If the server didn't provide subtitles (e.g. megaplay / echovideo),
    // automatically enrich subtitles from anitaku or zokoanime if available
    if (result.subtitles.length === 0) {
      try {
        if (ids.anilistId) {
          const anitakuData = await fetchVidnest('anitaku', ids.anilistId, episode, subDub);
          if (anitakuData.subtitles.length > 0) {
            result.subtitles = anitakuData.subtitles;
            if (!result.thumbnails && anitakuData.thumbnails) {
              result.thumbnails = anitakuData.thumbnails;
              result.proxiedThumbnails = anitakuData.proxiedThumbnails;
            }
          }
        }
      } catch {
        // Ignore fallback failure
      }

      if (result.subtitles.length === 0 && ids.malId) {
        try {
          const zokoData = await fetchZoko(ids.malId, episode, subDub);
          if (zokoData.subtitles.length > 0) {
            result.subtitles = zokoData.subtitles;
            if (!result.thumbnails && zokoData.thumbnails) {
              result.thumbnails = zokoData.thumbnails;
              result.proxiedThumbnails = zokoData.proxiedThumbnails;
            }
          }
        } catch {
          // Ignore fallback failure
        }
      }
    }

    return result;
  }
}

