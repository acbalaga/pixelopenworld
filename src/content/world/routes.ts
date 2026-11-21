/**
 * The harder ways out of a region (regions/01-dawnmeadow section 7, freedom of route). They count
 * under the pacing ledger's extras: the minutes are what the route costs over the easy way.
 */
export interface RouteDef {
  id: string;
  region: string;
  /** Minutes the route takes, planning estimate. */
  estMinutes: number;
}

export const ROUTES: readonly RouteDef[] = [
  // Athletics 25 and four ledges, two rest points (the Fernside climb stamp).
  { id: 'route.fernside_climb', region: 'dawnmeadow', estMinutes: 15 },
  // The Badger Sett's back door, past the sleeping sett mother (the badger tunnels).
  { id: 'route.badger_tunnels', region: 'dawnmeadow', estMinutes: 15 },
];
