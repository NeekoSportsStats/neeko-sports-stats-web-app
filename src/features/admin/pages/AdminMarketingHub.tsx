import MarketingStatsHub from "@/features/admin/marketing/MarketingStatsHub";

export default function AdminMarketingHub() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Marketing Hub</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Generate player stat tables, AI captions, and social graphics for marketing.
        </p>
      </div>
      <MarketingStatsHub />
    </div>
  );
}
