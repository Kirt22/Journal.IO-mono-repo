/**
 * App Store Connect API client.
 *
 * Auth is an ES256 JWT signed with the team's .p8 private key. Apple caps the
 * lifetime at 20 minutes; we mint 15-minute tokens and cache until just before
 * expiry. node:crypto signs ES256 directly, so this file has no dependencies.
 */

import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const API_BASE = 'https://api.appstoreconnect.apple.com';
const TOKEN_TTL_SECONDS = 15 * 60;
const TOKEN_REFRESH_MARGIN_SECONDS = 60;

export interface AscConfig {
  issuerId: string;
  keyId: string;
  privateKeyPath: string;
}

export const DEFAULT_CONFIG_PATH = '~/.appstoreconnect/config.json';

function expandHome(path: string): string {
  return path.replace(/^~(?=$|\/)/, process.env.HOME ?? '~');
}

/**
 * Credentials come from env vars if present, otherwise from a JSON file outside
 * the repo (default `~/.appstoreconnect/config.json`). The file path keeps the
 * repo and the MCP config free of secrets without needing shell rc edits.
 */
export async function loadConfig(): Promise<AscConfig> {
  let issuerId = process.env.ASC_ISSUER_ID;
  let keyId = process.env.ASC_KEY_ID;
  let privateKeyPath = process.env.ASC_PRIVATE_KEY_PATH;

  const configPath = expandHome(process.env.ASC_CONFIG_PATH ?? DEFAULT_CONFIG_PATH);
  if (!issuerId || !keyId || !privateKeyPath) {
    try {
      const file = JSON.parse(await readFile(configPath, 'utf8'));
      issuerId ||= file.issuerId;
      keyId ||= file.keyId;
      privateKeyPath ||= file.privateKeyPath;
    } catch {
      /* fall through to the missing-field error below */
    }
  }

  const missing = [
    ['issuerId (ASC_ISSUER_ID)', issuerId],
    ['keyId (ASC_KEY_ID)', keyId],
    ['privateKeyPath (ASC_PRIVATE_KEY_PATH)', privateKeyPath],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing App Store Connect credential(s): ${missing.join(', ')}. ` +
        `Set them as environment variables or write ${configPath}. ` +
        'See tools/asc-mcp/README.md for setup.',
    );
  }

  return {
    issuerId: issuerId!,
    keyId: keyId!,
    privateKeyPath: expandHome(privateKeyPath!),
  };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class AppStoreConnectClient {
  private privateKey: KeyObject | null = null;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: AscConfig) {}

  private async loadPrivateKey(): Promise<KeyObject> {
    if (this.privateKey) return this.privateKey;
    let pem: string;
    try {
      pem = await readFile(this.config.privateKeyPath, 'utf8');
    } catch (error) {
      throw new Error(
        `Could not read the App Store Connect private key at ${this.config.privateKeyPath}: ` +
          `${(error as Error).message}`,
      );
    }
    this.privateKey = createPrivateKey(pem);
    return this.privateKey;
  }

  /** Mints (and caches) the ES256 bearer token Apple expects. */
  private async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && now < this.tokenExpiresAt - TOKEN_REFRESH_MARGIN_SECONDS) {
      return this.token;
    }

    const exp = now + TOKEN_TTL_SECONDS;
    const header = base64url(
      JSON.stringify({ alg: 'ES256', kid: this.config.keyId, typ: 'JWT' }),
    );
    const payload = base64url(
      JSON.stringify({
        iss: this.config.issuerId,
        iat: now,
        exp,
        aud: 'appstoreconnect-v1',
      }),
    );

    const signingInput = `${header}.${payload}`;
    const signer = createSign('SHA256');
    signer.update(signingInput);
    signer.end();

    // Apple wants the raw R||S JWS signature, not the DER form Node emits by
    // default — 'ieee-p1363' is what produces it.
    const signature = signer.sign({
      key: await this.loadPrivateKey(),
      dsaEncoding: 'ieee-p1363',
    });

    this.token = `${signingInput}.${base64url(signature)}`;
    this.tokenExpiresAt = exp;
    return this.token;
  }

  /**
   * GET a path (absolute URL or `/v1/...`) and return the parsed JSON body.
   * Throws with Apple's own error detail, which is far more useful than the
   * bare status code.
   */
  async get(path: string, query: Record<string, string | number | undefined> = {}): Promise<any> {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${await this.getToken()}` },
    });

    const text = await response.text();
    if (!response.ok) {
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        detail = (parsed.errors ?? [])
          .map((e: any) => `${e.title}: ${e.detail}`)
          .join('; ') || text;
      } catch {
        /* fall back to the raw body */
      }
      throw new Error(`App Store Connect ${response.status} on ${url.pathname} — ${detail}`);
    }

    return text ? JSON.parse(text) : {};
  }

  /** Follows `links.next` so callers get the whole collection. */
  async getAll(path: string, query: Record<string, string | number | undefined> = {}): Promise<any[]> {
    const items: any[] = [];
    let next: string | undefined = undefined;
    let first = true;

    while (first || next) {
      const page: any = first ? await this.get(path, { limit: 200, ...query }) : await this.get(next!);
      items.push(...(page.data ?? []));
      next = page.links?.next;
      first = false;
    }

    return items;
  }

  /** Resolves a screenshot's templateUrl into a real, downloadable URL. */
  static renderImageAssetUrl(
    imageAsset: { templateUrl?: string; width?: number; height?: number } | null | undefined,
    format = 'png',
  ): string | null {
    if (!imageAsset?.templateUrl) return null;
    return imageAsset.templateUrl
      .replace('{w}', String(imageAsset.width ?? 1320))
      .replace('{h}', String(imageAsset.height ?? 2868))
      .replace('{f}', format);
  }
}
