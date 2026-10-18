// offline mode game room service
import type { AttemptProgress, AttemptResult, RoomInfo, RoomPlayer, RunUpdate } from './types'
import type { ScoreboardEntry } from './ranking';
import { createLocalRooms, type LocalRoomApi, type RoomStore } from './localRooms';
import type {RoomService} from './roomService';

export class OfflineRoomService implements RoomService {
  readonly mode = 'local' as const;
  private readonly rooms: LocalRoomApi;
  private session: RoomInfo | null = null;
  private currentAttemptId: string | null = null;
  private latestProgress: AttemptProgress | null = null;
  private finalResult: AttemptResult | null = null;

  constructor(store?: RoomStore) {
    this.rooms = createLocalRooms(store);
  }

  async createRoom(nickname: string): Promise<RoomInfo> {
    await this.leaveRoom();
    this.session = await this.rooms.createRoom(nickname);
    return this.session;
  }

  async joinRoom(roomCode: string, playerName: string): Promise<RoomInfo> {
    await this.leaveRoom();
    this.session = await this.rooms.joinRoom(roomCode, playerName);
    return this.session;
  }

  onPlayersChanged(listener: (players: RoomPlayer[]) => void): () => void {
    return this.rooms.onPlayersChanged(listener);
  }

  onStart(listener: (startAtEpochMs: number) => void): () => void {
    return this.rooms.onStart(listener);
  }

  startRoom(): Promise<void> {
    return this.rooms.startRoom();
  }

  reopenRoom(): Promise<void> {
    return this.rooms.reopenRoom();
  }

  publishRun(update: RunUpdate): void {
    this.rooms.publishRun(update);
  }

  onStandings(listener: (rows: ScoreboardEntry[]) => void): () => void {
    return this.rooms.onStandings(listener);
  }

  async leaveRoom(): Promise<void> {
    await this.rooms.leaveRoom();
    this.session = null;
    this.currentAttemptId = null;
    this.latestProgress = null;
    this.finalResult = null;
  }


  async startAttempt(): Promise<{ attemptId: string }> {
    if (this.session === null) {
      throw new Error("No Session has been created. Please join a room first.");
    }
    // set the fields with nessessary values for the current attempt
    this.currentAttemptId = 'offline-' + crypto.randomUUID();
    this.latestProgress = null;
    this.finalResult = null; 

    return { attemptId: this.currentAttemptId };
  }

  async publishAttemptProgress(attemptProgress: AttemptProgress): Promise<void> {
    // Ignore stale updates and updates after this attempt has ended.
    if (this.currentAttemptId !== attemptProgress.attemptId || this.finalResult !== null) {
      return;
    }

    this.latestProgress = { ...attemptProgress };
  }

  async publishAttemptResult(attemptResult: AttemptResult): Promise<void> {
    // Ignore stale results and keep the first final result for this attempt.
    if (this.currentAttemptId !== attemptResult.attemptId || this.finalResult !== null) {
      return;
    }

    // Store a copy of the final result.
    this.finalResult = { ...attemptResult };
  }

  async dispose(): Promise<void> {
    await this.leaveRoom();
    await this.rooms.dispose();
  }
}
