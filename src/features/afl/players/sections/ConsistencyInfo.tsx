import React from "react";
import { Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function MobileSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
          aria-label="Most Consistent explanation"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="border-t border-yellow-500/20 bg-gradient-to-br from-black via-[#050507] to-[#14100a] text-white animate-in slide-in-from-bottom duration-150"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl font-semibold text-yellow-300">
            Most Consistent
          </SheetTitle>
          <SheetDescription className="text-sm text-white/60">
            Week-to-week reliability indicator
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5 pb-4">
          <p className="text-base text-white/80 leading-relaxed">
            This highlights the player whose performance has stayed closest to
            their own recent average.
          </p>

          <ul className="space-y-2 text-sm text-white/75 pl-1">
            <li>• Compared against their own last 10 games</li>
            <li>• Measures game-to-game variation</li>
            <li>• Rewards stable, repeatable output</li>
          </ul>

          <div className="rounded-lg border border-yellow-500/20 bg-black/40 p-4">
            <h4 className="mb-3 text-sm font-semibold text-yellow-300">
              How to read the score
            </h4>
            <p className="mb-3 text-sm text-white/75 leading-relaxed">
              A higher percentage means the player delivers a similar level of
              output most weeks.
            </p>
            <div className="space-y-1.5 text-xs text-white/65">
              <div className="flex items-center justify-between">
                <span>90–100%</span>
                <span className="text-green-400">→ Extremely reliable</span>
              </div>
              <div className="flex items-center justify-between">
                <span>75–89%</span>
                <span className="text-yellow-400">→ Consistent contributor</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Below 75%</span>
                <span className="text-orange-400">→ Volatile performance</span>
              </div>
            </div>
          </div>

          <Accordion type="single" collapsible className="border-t border-yellow-500/10 pt-2">
            <AccordionItem value="calculation" className="border-b-0">
              <AccordionTrigger className="text-sm text-yellow-300/80 hover:text-yellow-300 py-3">
                How it's calculated
              </AccordionTrigger>
              <AccordionContent className="text-sm text-white/70 leading-relaxed pb-3">
                The score reflects how much a player's weekly output deviates
                from their recent average. Lower variation results in a higher
                consistency score.
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <p className="text-[11px] text-white/40 border-t border-yellow-500/10 pt-3">
            Minimum sample applied. Zero-score games excluded.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DesktopPopover() {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            aria-label="Most Consistent explanation"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[380px] border border-yellow-500/20 bg-gradient-to-br from-black via-[#050507] to-[#14100a] text-white shadow-[0_0_40px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-2 duration-150"
          align="end"
        >
          <div className="space-y-4">
            <div>
              <h4 className="mb-1 text-base font-semibold text-yellow-300">
                Most Consistent
              </h4>
              <p className="text-sm text-white/80 leading-relaxed">
                Identifies the player with the most stable output relative to
                their own recent average.
              </p>
            </div>

            <ul className="space-y-1.5 text-sm text-white/70 pl-1">
              <li>• Based on last 10 games</li>
              <li>• Measures performance variation</li>
              <li>• Higher % = greater reliability</li>
            </ul>

            <div className="rounded border border-yellow-500/20 bg-black/40 p-3">
              <p className="text-xs text-white/70 leading-relaxed">
                <span className="font-medium text-yellow-300">Example:</span>{" "}
                95% indicates extremely steady week-to-week performance.
              </p>
            </div>

            <button
              onClick={() => setShowDetails(true)}
              className="text-xs text-yellow-400/80 hover:text-yellow-400 transition-colors underline underline-offset-2"
            >
              View calculation details
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {showDetails && <MobileSheet />}
    </>
  );
}

export function ConsistencyInfo() {
  const isMobile = useIsMobile();

  return isMobile ? <MobileSheet /> : <DesktopPopover />;
}
