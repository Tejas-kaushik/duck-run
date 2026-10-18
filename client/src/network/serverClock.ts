// Server clock offset (Mayank). Players' computer clocks can be seconds apart, so the shared start
// time and "last seen" times come from the server and are converted to this tab's Date.now().
// Pure, so it can be tested without a network.

/** How many recent samples to keep. At one heartbeat every 5 s this is the last 30 s. */
const MAX_SAMPLES = 6;

interface Sample {
  roundTripMs: number;
  offsetMs: number;
}

export interface ServerClock {
  /**
   * Record one request: local Date.now() just before sending and just after the reply, and the
   * server's time in the reply. The server read its clock roughly halfway through.
   */
  sample(sentAtMs: number, receivedAtMs: number, serverNowMs: number): void;
  /** Server time minus local time, from the sample with the shortest round trip. 0 before any sample. */
  offsetMs(): number;
  /** A server timestamp in this tab's Date.now() time. */
  toLocal(serverMs: number): number;
  /** The server's current time, estimated. */
  serverNow(): number;
}

export function createServerClock(now: () => number = Date.now): ServerClock {
  const samples: Sample[] = [];

  const offsetMs = (): number => {
    if (samples.length === 0) return 0;
    // The quickest round trip has the least uncertainty about when the server read its clock.
    return samples.reduce((best, s) => (s.roundTripMs < best.roundTripMs ? s : best)).offsetMs;
  };

  return {
    sample(sentAtMs, receivedAtMs, serverNowMs) {
      if (!Number.isFinite(serverNowMs) || receivedAtMs < sentAtMs) return;
      samples.push({ roundTripMs: receivedAtMs - sentAtMs, offsetMs: serverNowMs - (sentAtMs + receivedAtMs) / 2 });
      if (samples.length > MAX_SAMPLES) samples.shift();
    },
    offsetMs,
    toLocal: (serverMs) => serverMs - offsetMs(),
    serverNow: () => now() + offsetMs(),
  };
}
