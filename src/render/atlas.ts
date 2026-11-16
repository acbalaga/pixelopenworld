/** Runtime atlas: manifest lookup, numeric frame handles, animation playback by time. */

/** Shape of `baked/manifest.json`. */
export interface Manifest {
  version: number;
  atlases: Record<string, { image: string; width: number; height: number }>;
  sprites: Record<
    string,
    {
      group: string;
      size: number[];
      origin: number[];
      frames: Record<string, { x: number; y: number; w: number; h: number }>;
      anims: Record<string, { fps: number; flipX?: boolean; frames: string[] }>;
    }
  >;
}

/**
 * Resolves names to small integer handles once (at load or scene setup), so drawing every frame
 * never builds strings or allocates. Handles are valid for the life of the atlas.
 */
export class Atlas {
  private frameIndex = new Map<string, number>();
  private animIndex = new Map<string, number>();
  private images: CanvasImageSource[] = [];
  private imgOf: number[] = [];
  private sx: number[] = [];
  private sy: number[] = [];
  private fw: number[] = [];
  private fh: number[] = [];
  private ox: number[] = [];
  private oy: number[] = [];
  private animFrames: number[][] = [];
  private animFps: number[] = [];
  private animFlipX: boolean[] = [];

  /** `images` maps atlas group name to its decoded image. */
  constructor(manifest: Manifest, images: Readonly<Record<string, CanvasImageSource>>) {
    const groupSlot = new Map<string, number>();
    for (const name of Object.keys(manifest.atlases).sort()) {
      const img = images[name];
      if (!img) throw new Error(`atlas image for group ${name} not provided`);
      groupSlot.set(name, this.images.length);
      this.images.push(img);
    }
    for (const id of Object.keys(manifest.sprites).sort()) {
      const s = manifest.sprites[id];
      if (s) this.register(id, s, groupSlot.get(s.group) ?? 0);
    }
  }

  /**
   * Adds a sprite whose pixels live in a canvas the caller owns (for example a composed
   * character). Frames are read from the canvas each draw, so redrawing it updates the sprite
   * without changing any handle.
   */
  addSprite(id: string, image: CanvasImageSource, entry: Manifest['sprites'][string]): void {
    const slot = this.images.length;
    this.images.push(image);
    this.register(id, entry, slot);
  }

  private register(id: string, s: Manifest['sprites'][string], slot: number): void {
    for (const f of Object.keys(s.frames).sort()) {
      const r = s.frames[f];
      if (!r) continue;
      const h = this.sx.length;
      this.frameIndex.set(`${id}#${f}`, h);
      this.imgOf.push(slot);
      this.sx.push(r.x);
      this.sy.push(r.y);
      this.fw.push(r.w);
      this.fh.push(r.h);
      this.ox.push(s.origin[0] ?? 0);
      this.oy.push(s.origin[1] ?? 0);
    }
    for (const a of Object.keys(s.anims).sort()) {
      const def = s.anims[a];
      if (!def) continue;
      this.animIndex.set(`${id}#${a}`, this.animFrames.length);
      this.animFrames.push(def.frames.map((f) => this.frame(id, f)));
      this.animFps.push(def.fps);
      this.animFlipX.push(def.flipX === true);
    }
  }

  /** Handle of a frame. Throws if the sprite or frame does not exist. */
  frame(spriteId: string, frame: string): number {
    const h = this.frameIndex.get(`${spriteId}#${frame}`);
    if (h === undefined) throw new Error(`unknown sprite frame ${spriteId}#${frame}`);
    return h;
  }

  /** Handle of an animation. */
  anim(spriteId: string, name: string): number {
    const h = this.animIndex.get(`${spriteId}#${name}`);
    if (h === undefined) throw new Error(`unknown animation ${spriteId}#${name}`);
    return h;
  }

  /** The frame handle playing at `timeMs` since the animation started. Loops. */
  animFrame(anim: number, timeMs: number): number {
    const frames = this.animFrames[anim] as number[];
    const i = Math.floor((timeMs / 1000) * (this.animFps[anim] as number)) % frames.length;
    return frames[i] as number;
  }

  /** True when the animation is drawn mirrored (left from right). */
  animFlip(anim: number): boolean {
    return this.animFlipX[anim] === true;
  }

  image(handle: number): CanvasImageSource {
    return this.images[this.imgOf[handle] as number] as CanvasImageSource;
  }
  srcX(handle: number): number {
    return this.sx[handle] as number;
  }
  srcY(handle: number): number {
    return this.sy[handle] as number;
  }
  width(handle: number): number {
    return this.fw[handle] as number;
  }
  height(handle: number): number {
    return this.fh[handle] as number;
  }
  originX(handle: number): number {
    return this.ox[handle] as number;
  }
  originY(handle: number): number {
    return this.oy[handle] as number;
  }
}

/**
 * Fetches atlas images and builds an {@link Atlas}. Groups without a url are skipped, so a scene
 * that only needs the core group does not load the UI atlas; asking for one of their frames
 * throws a clear error.
 */
export async function loadAtlas(
  manifest: Manifest,
  imageUrls: Readonly<Record<string, string>>,
): Promise<Atlas> {
  const images: Record<string, CanvasImageSource> = {};
  const loadable: Manifest = {
    ...manifest,
    atlases: Object.fromEntries(
      Object.entries(manifest.atlases).filter(([g]) => imageUrls[g] !== undefined),
    ),
    sprites: Object.fromEntries(
      Object.entries(manifest.sprites).filter(([, s]) => imageUrls[s.group] !== undefined),
    ),
  };
  await Promise.all(
    Object.keys(loadable.atlases).map(async (group) => {
      const img = new Image();
      img.src = imageUrls[group] as string;
      await img.decode();
      images[group] = img;
    }),
  );
  return new Atlas(loadable, images);
}
