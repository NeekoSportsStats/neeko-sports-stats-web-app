import RoundSummary from "@/components/afl/players/Section-6-overview/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

export default function RoundMomentum() {
  return <RoundSummary statConfig={AFL_STAT_CONFIG} />;
}
