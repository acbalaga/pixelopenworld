import { DOLL_DRAWN_DIRS, WORK_ANIMS, type WorkAnim } from './parts';

/**
 * Doll poses: where every body part is in each frame. Shared by the layer generator (which draws
 * the baked layers) and the client (which places face, hair and accessory stamps on the head).
 */
export type Dir = 'down' | 'up' | 'right';
export interface Pose {
  dir: Dir;
  bob: number;
  legDy: [number, number];
  armDy: [number, number];
  /** Profile only: arm swing and leg x positions (back, front). */
  armDx: number;
  legX: [number, number];
  /** What the arms are doing. Held items read it to pick their angle. */
  stance: 'rest' | 'windup' | 'strike' | 'recover' | 'hurt' | 'dodge';
  /** Whole figure shift in px, applied to every layer alike so they stay registered. */
  shiftX: number;
  shiftY: number;
}

export function poseOf(dir: Dir, step: number | 'idle'): Pose {
  const walking = step !== 'idle';
  return {
    dir,
    bob: step === 1 || step === 3 ? -1 : 0,
    legDy: step === 0 ? [1, -1] : step === 2 ? [-1, 1] : [0, 0],
    armDy: step === 0 ? [-1, 1] : step === 2 ? [1, -1] : [0, 0],
    armDx: !walking ? 0 : step === 0 ? -2 : step === 2 ? 2 : 0,
    legX: step === 0 ? [8, 14] : step === 2 ? [14, 8] : [10, 11],
    stance: 'rest',
    shiftX: 0,
    shiftY: 0,
  };
}

export type Action = 'attack' | 'hurt' | 'dodge';

/** Poses for attack (3 frames), hurt (1) and dodge (2). `toward` is the way the figure lunges. */
export function actionPose(dir: Dir, action: Action, n: number): Pose {
  const side = dir === 'right';
  const toward = dir === 'up' ? -1 : 1;
  const p = poseOf(dir, 'idle');
  if (action === 'attack') {
    p.stance = (['windup', 'strike', 'recover'] as const)[n] ?? 'rest';
    if (side) {
      p.armDx = [-3, 4, 1][n] ?? 0;
      p.legX = [9, 13];
      p.shiftX = n === 1 ? 1 : 0;
    } else {
      p.armDy = [
        [0, -4],
        [0, 3],
        [0, 1],
      ][n] as [number, number];
      p.legDy = [0, 0];
      p.shiftY = n === 1 ? toward : 0;
    }
  } else if (action === 'hurt') {
    p.stance = 'hurt';
    if (side) {
      p.armDx = -2;
      p.legX = [8, 14];
      p.shiftX = -2;
    } else {
      p.armDy = [-2, -2];
      p.legDy = [1, -1];
      p.shiftY = -toward;
    }
  } else {
    p.stance = 'dodge';
    p.bob = n === 0 ? 2 : 3;
    p.legX = [8, 14];
    p.armDy = [-1, -1];
    if (side) {
      p.armDx = -2;
      p.shiftX = n === 0 ? 1 : 3;
    } else p.shiftY = n === 0 ? 0 : toward;
  }
  return p;
}

/**
 * Poses for the four frames of a work animation. Held items read `stance`, so a swing reuses the
 * attack stances and the rest stay at rest with the arms doing the work.
 */
export function workPose(dir: Dir, work: WorkAnim, n: number): Pose {
  const side = dir === 'right';
  const toward = dir === 'up' ? -1 : 1;
  const p = poseOf(dir, 'idle');
  switch (work) {
    case 'work_swing': {
      const a = actionPose(dir, 'attack', n < 3 ? n : 0);
      return n < 3 ? a : p;
    }
    case 'work_reach':
      p.bob = n === 1 || n === 2 ? 1 : 0;
      if (side) {
        p.armDx = [0, 3, 3, 1][n] as number;
        p.shiftX = n === 1 || n === 2 ? 1 : 0;
      } else {
        p.armDy = [
          [0, 0],
          [2, 2],
          [2, 2],
          [0, 1],
        ][n] as [number, number];
        p.shiftY = n === 1 || n === 2 ? toward : 0;
      }
      return p;
    case 'work_stir':
      if (side) p.armDx = [-1, 2, 1, -2][n] as number;
      else
        p.armDy = [
          [-1, 0],
          [0, -1],
          [1, 0],
          [0, 1],
        ][n] as [number, number];
      p.bob = n === 1 ? -1 : 0;
      return p;
    case 'work_hands':
      p.stance = n % 2 === 0 ? 'rest' : 'windup';
      if (side) p.armDx = [0, 2, 0, 2][n] as number;
      else p.armDy = n % 2 === 0 ? [-2, -2] : [1, 1];
      p.bob = n % 2 === 0 ? 0 : 1;
      return p;
    case 'work_cast':
      p.stance = (['windup', 'strike', 'recover', 'rest'] as const)[n] ?? 'rest';
      if (side) {
        p.armDx = [-3, 4, 3, 3][n] as number;
        p.legX = [9, 13];
      } else
        p.armDy = [
          [0, -4],
          [0, 3],
          [0, 2],
          [0, 2],
        ][n] as [number, number];
      return p;
  }
}

/** Every frame name with its pose, in the order the atlas stores them. */
export const POSES: { name: string; pose: Pose }[] = [
  ...DOLL_DRAWN_DIRS.flatMap((d) =>
    [0, 1, 2, 3].map((n) => ({ name: `walk_${d}_${n}`, pose: poseOf(d, n) })),
  ),
  ...DOLL_DRAWN_DIRS.map((d) => ({ name: `idle_${d}`, pose: poseOf(d, 'idle') })),
  ...DOLL_DRAWN_DIRS.flatMap((d) =>
    [0, 1, 2].map((n) => ({ name: `attack_${d}_${n}`, pose: actionPose(d, 'attack', n) })),
  ),
  ...DOLL_DRAWN_DIRS.map((d) => ({ name: `hurt_${d}`, pose: actionPose(d, 'hurt', 0) })),
  ...DOLL_DRAWN_DIRS.flatMap((d) =>
    [0, 1].map((n) => ({ name: `dodge_${d}_${n}`, pose: actionPose(d, 'dodge', n) })),
  ),
  ...WORK_ANIMS.flatMap((w) =>
    DOLL_DRAWN_DIRS.flatMap((d) =>
      [0, 1, 2, 3].map((n) => ({ name: `${w}_${d}_${n}`, pose: workPose(d, w, n) })),
    ),
  ),
];

const BY_NAME = new Map(POSES.map((p) => [p.name, p.pose]));

/** Where the head is in a frame: the way it faces and how far it has moved from rest. */
export function headOf(frame: string): { dir: Dir; dx: number; dy: number } {
  const p = BY_NAME.get(frame);
  if (!p) throw new Error(`unknown doll frame ${frame}`);
  return { dir: p.dir, dx: p.shiftX, dy: p.bob + p.shiftY };
}
