import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PremiumGateProps {
  children: ReactNode;
  blur?: boolean;
}

export function PremiumGate({ children, blur = true }: PremiumGateProps) {
  const { isPremium } = useAuth();
  const navigate = useNavigate();

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className={blur ? "blur-sm pointer-events-none select-none" : ""}>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-lg">
              <Crown className="mr-2 h-5 w-5" />
              Unlock with Neeko+
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Lock className="h-6 w-6 text-primary" />
                Premium Content
              </DialogTitle>
              <DialogDescription className="space-y-4 pt-4">
                <p className="text-base">
                  This content is exclusive to Neeko+ subscribers.
                </p>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">
                    With Neeko+ you get:
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Unlimited access to all player stats</li>
                    <li>✓ AI-powered insights and predictions</li>
                    <li>✓ Advanced team analytics</li>
                    <li>✓ No content restrictions</li>
                    <li>✓ Premium features across all sports</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => { window.location.href = "https://www.neekostats.com.au/neeko-plus"; }}
                    size="lg"
                    className="w-full"
                  >
                    <Crown className="mr-2 h-5 w-5" />
                    Subscribe to Neeko+
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    $5.99/week • Cancel anytime
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
