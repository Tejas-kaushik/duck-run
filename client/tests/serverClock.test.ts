import { describe, expect, it } from 'vitest';
import { createServerClock } from '../src/network/serverClock';
import { looksLikeSecretKey } from '../src/network/supabase';

describe('server clock', () => {
  it('assumes the server read its clock halfway through the request', () => {
    const clock = createServerClock(() => 5000);
    clock.sample(1000, 1200, 11100); // midpoint 1100 locally = 11100 on the server
    expect(clock.offsetMs()).toBe(10000);
    expect(clock.toLocal(13000)).toBe(3000);
    expect(clock.serverNow()).toBe(15000);
  });

  it('trusts the quickest round trip', () => {
    const clock = createServerClock();
    clock.sample(0, 2000, 6000); // slow: offset 5000, very uncertain
    clock.sample(10000, 10020, 10010 + 3000); // fast: offset 3000
    expect(clock.offsetMs()).toBe(3000);
  });

  it('is 0 before any sample and ignores nonsense', () => {
    const clock = createServerClock();
    expect(clock.offsetMs()).toBe(0);
    clock.sample(100, 50, 999); // reply before the request
    clock.sample(0, 10, Number.NaN);
    expect(clock.offsetMs()).toBe(0);
  });
});

describe('secret key guard', () => {
  const jwt = (payload: object) =>
    ['header', btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), 'sig'].join('.');

  it('refuses secret keys of both styles', () => {
    expect(looksLikeSecretKey('sb_secret_abc123')).toBe(true);
    expect(looksLikeSecretKey(jwt({ role: 'service_role' }))).toBe(true);
  });

  it('accepts publishable and anon keys', () => {
    expect(looksLikeSecretKey('sb_publishable_abc123')).toBe(false);
    expect(looksLikeSecretKey(jwt({ role: 'anon' }))).toBe(false);
    expect(looksLikeSecretKey('not.a.jwt')).toBe(false);
  });
});
