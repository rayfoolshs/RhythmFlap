import type { Tier } from "./types";

/**
 * The nine starting tiers. Same vocabulary as the original trainer: the tempo
 * climbs with the tier and the duration set widens.
 */
export const TIERS: Tier[] = [
  {
    id: 1,
    name: "Eighths & Rests",
    startBpm: 72,
    values: [0.5],
    allowedRests: [0.5],
    restProb: 0.3,
    ties: false,
    syncopation: false,
  },
  {
    id: 2,
    name: "Eighths & Ties",
    startBpm: 76,
    values: [0.5],
    allowedRests: [],
    restProb: 0,
    ties: true,
    syncopation: true,
  },
  {
    id: 3,
    name: "Eighths, Rests, Ties",
    startBpm: 80,
    values: [0.5],
    allowedRests: [0.5],
    restProb: 0.3,
    ties: true,
    syncopation: true,
  },
  {
    id: 4,
    name: "Unsyncopated Mix",
    startBpm: 84,
    values: [0.5, 1],
    allowedRests: [0.5],
    restProb: 0.3,
    ties: false,
    syncopation: false,
  },
  {
    id: 5,
    name: "Quarters, Eighths, Ties",
    startBpm: 88,
    values: [0.5, 1],
    allowedRests: [0.5],
    restProb: 0.3,
    ties: true,
    syncopation: true,
  },
  {
    id: 6,
    name: "Dotted Notes",
    startBpm: 92,
    values: [0.5, 1, 1.5],
    allowedRests: [0.5],
    restProb: 0.3,
    ties: false,
    syncopation: true,
  },
  {
    id: 7,
    name: "Dotted Notes & Ties",
    startBpm: 96,
    values: [0.5, 1, 1.5],
    allowedRests: [0.5],
    restProb: 0.3,
    ties: true,
    syncopation: true,
  },
  {
    id: 8,
    name: "Dotted Rests",
    startBpm: 100,
    values: [0.5, 1, 1.5],
    allowedRests: [0.5, 1.5],
    restProb: 0.3,
    ties: false,
    syncopation: true,
  },
  {
    id: 9,
    name: "Master Rhythm",
    startBpm: 108,
    values: [0.5, 1, 1.5],
    allowedRests: [0.5, 1.5],
    restProb: 0.3,
    ties: true,
    syncopation: true,
  },
];

export function tierById(id: number): Tier {
  return TIERS.find((tier) => tier.id === id) ?? TIERS[0];
}
