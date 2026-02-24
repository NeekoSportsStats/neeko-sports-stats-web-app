// src/pages/NeekoPlusPurchase.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Loader2, ArrowLeft, TrendingUp, Target, Zap, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NeekoPlusPurchase = () => {
  const [loading, setLoading] = useState(false);
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const price = "5.99";

  const features = [
    "Advanced AI-powered analytics",
    "Predictive match outcomes",
    "Player performance trends",
    "Team comparison insights",
    "Priority support",
    "Early access to new features",
  ];

  const trustFeatures = [
    {
      icon: TrendingUp,
      title: "Data-driven edge",
      description:
        "Advanced trend modelling across AFL, EPL, and NBA — designed to surface momentum shifts before they show up in box scores.",
    },
    {
      icon: Target,
      title: "Fantasy-first analysis",
      description:
        "Every metric is tuned for fantasy relevance, including hit-rate thresholds, volatility bands, and ceiling projections.",
    },
    {
      icon: Zap,
      title: "Built weekly, not retrospectively",
      description:
        "Neeko+ is designed around upcoming matchups — not post-game summaries.",
    },
    {
      icon: Users,
      title: "Trusted by growing community",
      description:
        "Used weekly by a growing base of fantasy-focused users preparing lineups, trades, and match decisions.",
    },
  ];

  // 🔥 Prevent premium users from entering checkout
  useEffect(() => {
    if (isPremium) {
      console.log("🔐 User already premium — disabling checkout button");
    }
  }, [isPremium]);

  const handleSubscribe = async () => {
    if (isPremium) {
      toast({
        title: "Already subscribed",
        description: "You already have an active Neeko+ membership.",
      });
      navigate("/account");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Please log in first",
          description: "You need to be logged in to subscribe.",
          variant: "destructive",
        });
        navigate("/auth?redirect=checkout");
        return;
      }

      const origin = window.location.origin;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            price_id:    import.meta.env.VITE_STRIPE_PRICE_ID || "price_1SRKQUEKV8332a9YamiWbA5L",
            success_url: `${origin}/success`,
            cancel_url:  `${origin}/neeko-plus`,
            mode:        "subscription",
          }),
        }
      );

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || `Checkout request failed (${res.status})`);
      }

      const data = await res.json();

      if (!data.url) throw new Error("No checkout URL returned");

      window.location.assign(data.url);
    } catch (err: any) {
      toast({
        title: "Checkout failed",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8 md:py-12 px-4">
      {/* BACK BUTTON */}
      <Button
        variant="ghost"
        className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Button>

      {/* HEADER */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Crown className="h-10 w-10 text-primary" />
          <h1 className="text-5xl font-extrabold">Neeko+</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Unlock premium sports analytics and AI insights
        </p>
      </div>

      {/* MAIN CARD */}
      <div className="relative mb-10 md:mb-16">
        <div
          className="
          absolute inset-0 -z-10
          blur-[140px]
          opacity-70
          bg-[radial-gradient(circle_at_center,rgba(255,200,60,0.55),rgba(255,170,30,0.35),rgba(255,140,0,0.15),transparent)]
        "
        />

        <Card className="border-primary/40 hover:border-primary transition-all shadow-xl rounded-2xl bg-black/40 backdrop-blur-sm p-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Neeko+
              <Badge>Premium</Badge>
            </CardTitle>

            <CardDescription>
              Advanced analytics and AI insights for serious fans and fantasy
              players.
            </CardDescription>

            {/* PRICE */}
            <div className="pt-4 flex items-end gap-2 relative">
              <span className="text-5xl font-extrabold text-white animate-[pulse_3s_ease-in-out_infinite]">
                ${price}
              </span>
              <span className="text-muted-foreground mb-1">
                /week — cancel anytime
              </span>

              <div className="absolute left-0 right-0 -bottom-2 h-3 bg-gradient-to-r from-transparent via-amber-300/40 to-transparent rounded-full blur-md" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3 mt-6">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>

          {/* BUTTONS */}
          <CardFooter className="flex flex-col gap-3 pt-4">
            {!isPremium && (
              <Button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full text-lg font-bold transition-all hover:-translate-y-0.5"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Processing…
                  </>
                ) : (
                  "Get Neeko+ Now"
                )}
              </Button>
            )}

            {isPremium && (
              <Button
                onClick={() => navigate("/account")}
                variant="outline"
                className="w-full text-lg"
              >
                Manage Subscription
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* TRUST FEATURES */}
      <div className="mt-20">
        <h2 className="text-3xl font-bold mb-2 text-center">
          Why serious fantasy players use Neeko+
        </h2>
        <p className="text-muted-foreground text-center mb-10">
          Built for decision-makers who want clarity, not noise.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {trustFeatures.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="p-6 bg-black/40 border-primary/20 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>

        <p className="text-center mt-8 text-xs text-muted-foreground">
          No hype. No betting tips. Just structured insight.
        </p>
      </div>
    </div>
  );
};

export default NeekoPlusPurchase;
