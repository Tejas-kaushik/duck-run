// Room invites (Tejas): the join link and its QR code. Phones scan it and land on the join screen
// with the code filled in.

import qrcode from 'qrcode-generator';

const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * The address a phone should open. A phone can't reach "localhost", so on the dev machine the
 * local-network address from vite.config.ts is used instead (same port). VITE_PUBLIC_URL overrides both.
 */
export function joinUrl(code: string, location: Pick<Location, 'protocol' | 'hostname' | 'port' | 'origin' | 'pathname'> = window.location): string {
  const configured = import.meta.env.VITE_PUBLIC_URL?.replace(/\/$/, '');
  let base = configured || location.origin + location.pathname.replace(/\/$/, '');
  if (!configured && LOCAL_NAMES.has(location.hostname) && __LAN_HOST__) {
    base = `${location.protocol}//${__LAN_HOST__}${location.port ? `:${location.port}` : ''}${location.pathname.replace(/\/$/, '')}`;
  }
  return `${base}/?room=${encodeURIComponent(code)}`;
}

/** True when the link would only work on this computer (no network address found). */
export function linkIsLocalOnly(url: string): boolean {
  try {
    return LOCAL_NAMES.has(new URL(url).hostname);
  } catch {
    return true;
  }
}

/** An SVG QR code for `text`, scaling to its container. */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
