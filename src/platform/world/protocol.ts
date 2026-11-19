import type { Chunk } from '../../sim/world/chunk';
import type { ManifestFile, RegionManifest } from './chunkSource';

/** Messages to the chunk worker. `id` pairs a reply with its request. */
export type WorkerRequest =
  | { type: 'manifest'; id: number; region: string }
  | { type: 'chunk'; id: number; region: string; file: ManifestFile }
  | { type: 'prefetch'; id: number; manifest: RegionManifest }
  | { type: 'pin'; id: number; region: string; on: boolean }
  | { type: 'status'; id: number; manifest: RegionManifest };

/** Messages from the chunk worker. */
export type WorkerReply =
  | { type: 'manifest'; id: number; manifest: RegionManifest }
  | { type: 'chunk'; id: number; chunk: Chunk }
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'done'; id: number }
  | { type: 'status'; id: number; complete: boolean; pinned: boolean }
  | { type: 'error'; id: number; message: string };
