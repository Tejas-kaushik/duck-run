import { describe, expect, it } from 'vitest';
import { memoryRoomStore } from '../src/network/localRooms';
import { OfflineRoomService } from '../src/network/offlineRoomService';

describe('offline room service lifecycle', () => {
  it('requires a room for attempts and clears the session on leaving', async () => {
    const service = new OfflineRoomService(memoryRoomStore());
    await expect(service.startAttempt()).rejects.toThrow(/join a room/i);
    const room = await service.createRoom('Duck');
    const first = await service.startAttempt();
    const retry = await service.startAttempt();
    expect(retry.attemptId).not.toBe(first.attemptId);
    await service.leaveRoom();
    await expect(service.startAttempt()).rejects.toThrow(/join a room/i);
    await expect(service.joinRoom(room.code, 'Duck')).rejects.toThrow(/No room/);
  });

  it('leaves the old room when switching rooms and removes membership on disposal', async () => {
    const store = memoryRoomStore();
    const host = new OfflineRoomService(store);
    const guest = new OfflineRoomService(store);
    const oldRoom = await guest.createRoom('Guest');
    const room = await host.createRoom('Host');
    const joined = await guest.joinRoom(room.code, 'Guest');
    expect(store.read(oldRoom.code)).toBeNull();
    expect(joined.seed).toBe(room.seed);
    expect(joined.playerId).not.toBe(room.playerId);
    await guest.dispose();
    expect(store.read(room.code)?.players.map((p) => p.nickname)).toEqual(['Host']);
    await expect(guest.startAttempt()).rejects.toThrow(/join a room/i);
    await host.dispose();
    expect(store.read(room.code)).toBeNull();
  });
});
