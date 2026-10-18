// The lobby's RoomApi plus attempt publishing. Room membership has one shared contract.

import type { AttemptProgress, AttemptResult, RoomApi } from './types'

export interface RoomService extends RoomApi {
  // Start tracking an attempt in the current room.
  startAttempt(): Promise<{ attemptId: string }>

  publishAttemptProgress(attemptProgress: AttemptProgress): Promise<void>

  publishAttemptResult(attemptResult: AttemptResult): Promise<void>

  dispose(): Promise<void>
}
