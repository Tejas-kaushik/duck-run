import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * This machine's address on the local network, so the lobby's QR code works on phones: a phone
 * can't open "localhost". Virtual adapters (WSL, Hyper-V, VMs, Docker) are skipped.
 */
function lanHost(): string {
  const skip = /vethernet|wsl|virtual|vmware|vbox|hyper-v|docker|loopback|tailscale|zerotier/i;
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (skip.test(name)) continue;
    const ipv4 = addresses?.find((a) => a.family === 'IPv4' && !a.internal);
    if (ipv4) return ipv4.address;
  }
  return '';
}

export default defineConfig({
  server: {
    // Listen on the network too, so phones on the same Wi-Fi can join a room by scanning its QR code.
    host: true,
  },
  define: {
    __LAN_HOST__: JSON.stringify(lanHost()),
  },
  build: {
    rollupOptions: {
      // Two pages: the game, and the dev-only Bill preview.
      input: {
        main: resolve(__dirname, 'index.html'),
        character: resolve(__dirname, 'character-preview.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
