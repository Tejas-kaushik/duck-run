import { describe, expect, it } from 'vitest';
import { createLocalRooms, memoryRoomStore } from '../src/network/localRooms';
import { OfflineRoomService } from '../src/network/offlineRoomService';
import type { RoomStore } from '../src/network/localRooms';
import type { RoomApi } from '../src/network/types';
import type { RoomPlayer } from '../src/network/types';

/** Two RoomApis sharing one store behave like two browser tabs. */
describe.each([
  { name: 'local room storage', create: createLocalRooms },
  { name: 'offline room service used by the game', create: (store: RoomStore) => new OfflineRoomService(store) },
])('$name', ({ create }: { create: (store: RoomStore) => RoomApi }) => {
  const twoTabs = () => {
    const store = memoryRoomStore();
    return [create(store), create(store)] as const;
  };
  it('lets a second player join with the code and see the same seed', async () => {
    const [host, guest] = twoTabs();
    const room = await host.createRoom('Tejas');
    expect(room.isHost).toBe(true);
    expect(room.code).toMatch(/^[A-Z]{4}$/);

    const joined = await guest.joinRoom(room.code.toLowerCase(), 'Zubair');
    expect(joined.isHost).toBe(false);
    expect(joined.seed).toBe(room.seed);
  });

  it('keeps both players up to date on who is in the room', async () => {
    const [host, guest] = twoTabs();
    const room = await host.createRoom('Tejas');
    let seen: RoomPlayer[] = [];
    host.onPlayersChanged((players) => (seen = players));
    await guest.joinRoom(room.code, 'Rayyan');
    expect(seen.map((p) => p.nickname)).toEqual(['Tejas', 'Rayyan']);
    expect(seen.find((p) => p.isHost)?.nickname).toBe('Tejas');

    await guest.leaveRoom();
    expect(seen.map((p) => p.nickname)).toEqual(['Tejas']);
  });

  it('starts everyone at the same moment, and only the host can start', async () => {
    const [host, guest] = twoTabs();
    const room = await host.createRoom('Tejas');
    await guest.joinRoom(room.code, 'Mayank');
    const starts: number[] = [];
    host.onStart((at) => starts.push(at));
    guest.onStart((at) => starts.push(at));

    await expect(guest.startRoom()).rejects.toThrow(/host/);
    await host.startRoom();
    expect(starts).toHaveLength(2);
    expect(starts[0]).toBe(starts[1]);
    expect(starts[0]).toBeGreaterThan(Date.now());
  });

  it('gives a readable error for a wrong code or a bad nickname', async () => {
    const [host] = twoTabs();
    await expect(host.joinRoom('ZZZZ', 'Vansh')).rejects.toThrow(/No room called ZZZZ/);
    await expect(host.createRoom('   ')).rejects.toThrow(/nickname/);
    await expect(host.createRoom('x'.repeat(17))).rejects.toThrow(/nickname/);
  });
});
