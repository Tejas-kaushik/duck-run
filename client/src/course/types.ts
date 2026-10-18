// Shared runner course format (Rayyan + Tejas, TEAM_SPLIT §2).
// course/generateCourse.ts produces it; RunnerPhase consumes it.

export type Lane = 0 | 1 | 2;

export type CourseItemKind = 'branch' | 'crumb' | 'heart';

export interface CourseItem {
  /** Distance from the start of the section, in world units. Placed by distance, never by time. */
  distance: number;
  /** Lanes the item covers. A branch may cover 1 or 2 lanes, never all 3. */
  lanes: Lane[];
  kind: CourseItemKind;
}

export interface Course {
  length: number;
  /** Sorted by distance. */
  items: CourseItem[];
}

/** A hand-made piece of course. `at` is measured from the start of the chunk. */
export interface Chunk {
  name: string;
  length: number;
  items: { at: number; lanes: Lane[]; kind: 'branch' | 'crumb' }[];
}
