import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type State =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

const StartCheckout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    let attempts = 0;

    const go = async () => {
      attempts++;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (attempts < 12) {
          setTimeout(go, 200);
          return;
        }
        toast({
          title: "Please log in",
          description: "You must be signed in to continue to checkout.",
          variant: "destructive",
        });
        navigate("/auth?redirect=checkout");
        return;
      }

      try {
        const origin = window.location.origin;
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              price_id:    import.meta.env.VITE_STRIPE_PRICE_ID,
              success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url:  `${origin}/neeko-plus`,
              mode:        "subscription",
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.error || `Checkout request failed (${response.status})`);
        }

        const data = await response.json();
        if (!data.url) throw new Error("No checkout URL returned");

        setState({ status: "ready", url: data.url });

        window.location.assign(data.url);
      } catch (err: any) {
        setState({ status: "error", message: err?.message || "Something went wrong." });
      }
    };

    go();
  }, [navigate, toast]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Preparing secure checkout…</p>
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <p className="text-muted-foreground text-sm">Ready to continue</p>
        <Button
          size="lg"
          className="w-full max-w-xs text-base font-semibold"
          onClick={() => window.location.assign(state.url)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Continue to Stripe
        </Button>
        <Link
          to="/neeko-plus"
          className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Neeko+
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <p className="text-destructive font-medium">{state.message}</p>
      <Button variant="outline" onClick={() => navigate("/neeko-plus")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Neeko+
      </Button>
    </div>
  );
};

export default StartCheckout;
