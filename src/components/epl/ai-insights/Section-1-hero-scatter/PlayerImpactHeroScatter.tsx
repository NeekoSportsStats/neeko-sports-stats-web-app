import React, { useEffect, useMemo, useState } from "react";
import type { FixtureMatch } from "@/components/epl/match-center/types";
import type { PremiumMode } from "@/components/epl/ai-insights/data/types";
import type { StatConfig } from "@/lib/stats/types";

import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";

function useIsMobile(breakpointPx = 860) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [breakpointPx]);

  return isMobile;
}

export default function PlayerImpactHeroScatter(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: string;
  statConfig: StatConfig;
}) {
  const { match, mode, initialLens, statConfig } = props;
  const isMobile = useIsMobile();

  const Component = useMemo(
    () => (isMobile ? PlayerImpactHeroScatterMobile : PlayerImpactHeroScatterDesktop),
    [isMobile]
  );

  return <Component match={match} mode={mode} initialLens={initialLens} statConfig={statConfig} />;
}
