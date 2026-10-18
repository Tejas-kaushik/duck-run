/// <reference types="vite/client" />

/** This machine's local-network IP from vite.config.ts ('' if none), for the lobby's QR join link. */
declare const __LAN_HOST__: string;

interface ImportMetaEnv {
  /** Optional: the public address phones should open, e.g. a deployed URL. Overrides the LAN address. */
  readonly VITE_PUBLIC_URL?: string;
}
