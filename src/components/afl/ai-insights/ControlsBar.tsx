import React from "react";
import { STAT_LABEL, StatType, cx } from "./utils";

export function ControlsBar(props: {
  stat: StatType;
  onChangeStat: (s: StatType) => void;
  extraRight?: React.ReactNode;
}) {
  const { stat, onChangeStat, extraRight } = props;

  const btn = (s: StatType) => {
    const active = s === stat;
    return (
      <button
        key={s}
        type="button"
        onClick={() => onChangeStat(s)}
        className={cx(
          "rounded-full px-3 py-1 text-sm transition",
          active
            ? "border border-amber-400/40 bg-amber-500/15 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.12)]"
            : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 hover:text-white"
        )}
      >
        {STAT_LABEL[s]}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {btn("fantasy")}
        {btn("disposals")}
        {btn("goals")}
      </div>
      {extraRight ? <div className="flex items-center gap-2">{extraRight}</div> : null}
    </div>
  );
}
