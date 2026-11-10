import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'lt_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const TOKEN_FORMAT_REGEX = /^[a-f0-9]{48,64}$/;

function getSessionSigningKey(): string | null {
  return process.env.SESSION_SECRET || process.env.TURSO_AUTH_TOKEN || null;
}

export function generateSessionToken(): string {
  // 256-bit cryptographically random session token (64 hex chars)
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  const secret = getSessionSigningKey();
  if (secret) {
    return crypto.createHmac('sha256', secret).update(`linktwin-session:${token}`).digest('hex');
  }
  return crypto.createHash('sha256').update(`linktwin-session:${token}`).digest('hex');
}

export function extractSessionToken(req: Request): string {
  const cookieHeader = String(req.headers.cookie || '');
  const prefix = `${SESSION_COOKIE_NAME}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const candidate = trimmed.slice(prefix.length).trim();
      if (TOKEN_FORMAT_REGEX.test(candidate)) {
        return candidate;
      }
      return '';
    }
  }
  return '';
}

export function getCallerSessionHash(req: Request): string | null {
  const token = extractSessionToken(req);
  if (!token) return null;
  return hashSessionToken(token);
}

export function safeEqualHash(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isHttpsRequest(req: Request): boolean {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return true;
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim().toLowerCase() === 'https') {
    return true;
  }
  return false;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const secureFlag = isHttpsRequest(req) ? '; Secure' : '';
  const cookieValue = `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`;
  res.append('Set-Cookie', cookieValue);
}

export function getAllowedOrigins(req?: Request): Set<string> {
  const allowed = new Set<string>();
  if (process.env.BASE_URL) {
    try {
      allowed.add(new URL(process.env.BASE_URL).origin.toLowerCase());
    } catch {}
  }
  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`.toLowerCase());
  }
  if (req) {
    const rawHost = req.headers['x-forwarded-host'] || req.get('host');
    const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    if (host) {
      allowed.add(`http://${host}`.toLowerCase());
      allowed.add(`https://${host}`.toLowerCase());
    }
  }
  return allowed;
}

/**
 * CSRF protection for state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
 * Rejects cross-site requests indicated by `Sec-Fetch-Site` or mismatched `Origin` / `Referer`.
 */
export function enforceSameOriginOnMutations(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    res.status(403).json({ error: 'Cross-site state-changing request rejected by CSRF policy.' });
    return;
  }

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const allowedOrigins = getAllowedOrigins(req);

  if (typeof originHeader === 'string' && originHeader.trim()) {
    const normalizedOrigin = originHeader.trim().toLowerCase();
    if (normalizedOrigin === 'null' || !allowedOrigins.has(normalizedOrigin)) {
      res.status(403).json({ error: 'Invalid request origin for mutating operation.' });
      return;
    }
  } else if (typeof refererHeader === 'string' && refererHeader.trim()) {
    try {
      const refOrigin = new URL(refererHeader).origin.toLowerCase();
      if (!allowedOrigins.has(refOrigin)) {
        res.status(403).json({ error: 'Invalid referer origin for mutating operation.' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Malformed referer header.' });
      return;
    }
  }

  next();
}
