// src/components/afl/players/playerStatConfig.ts

export type StatConfig = {
  label: "Fantasy" | "Disposals" | "Goals";
  valueUnitShort: string;
  thresholds: readonly number[];
};

export const STAT_CONFIG: Record<StatConfig["label"], StatConfig> = {
  Fantasy: {
    label: "Fantasy",
    valueUnitShort: "pts",
    thresholds: [60, 70, 80, 90, 100],
  },
  Disposals: {
    label: "Disposals",
    valueUnitShort: "disp",
    thresholds: [15, 20, 25, 30],
  },
  Goals: {
    label: "Goals",
    valueUnitShort: "g",
    thresholds: [1, 2, 3, 4],
  },
};
