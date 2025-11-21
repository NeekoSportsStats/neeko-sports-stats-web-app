import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  Check,
  Sparkles,
  TrendingUp,
  Brain,
  Lock,
  Zap,
  BarChart3,
  Shield,
} from "lucide-react";

export default function NeekoPlusPurchase() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const priceId = import.meta.env.VITE_STRIPE_PRICE_ID;

  const handleSubscribe = async () => {
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Please log in first",
          description: "You need to be logged in to subscribe",
          variant: "destructive",
        });
        setLoading(false);
        navigate("/auth?redirect=/neeko-plus");
        return;
      }

      const res = await fetch("https://zbomenuickrogthnsozb.functions.supabase.co/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId: import.meta.env.VITE_STRIPE_PRICE_ID,
        }),
      });

      const data = await res.json();

      if (data.error || !data.url) {
        console.error("Checkout error:", data.error);
        throw new Error("Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (err: any) {
      toast({
        title: "Checkout failed",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });

      setLoading(false);
    }
  };

  const premiumFeatures = [
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description:
        "Advanced machine learning analysis for player performance predictions and trend detection",
    },
    {
      icon: TrendingUp,
      title: "Unlimited Player Stats",
      description:
        "Full access to comprehensive player statistics across AFL, EPL, and NBA",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description:
        "Deep-dive team comparisons, head-to-head matchups, and historical data analysis",
    },
    {
      icon: Sparkles,
      title: "Premium AI Analysis",
      description:
        "Exclusive AI-generated insights, hot/cold player detection, and form analysis",
    },
    {
      icon: Lock,
      title: "No Blurred Content",
      description:
        "Remove all content restrictions and access every feature without limitations",
    },
    {
      icon: Zap,
      title: "Priority Updates",
      description:
        "Get the latest stats and insights first with priority data refresh",
    },
  ];

  const benefits = [
    "Access to full AFL, EPL & NBA player stats",
    "Advanced team performance breakdowns",
    "Full AI-powered match analysis",
    "Deeper insights across all leagues (no blur or gating)",
    "Early access to new analytics and features",
    "Priority processing for AI analysis refresh",
    "Ad-free browsing",
    "Cancel anytime — no lock-in",
  ];

  return (
    <div className="min-h-screen">
      <section className="relative py-20 bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
              <Crown className="h-4 w-4" />
              <span>Premium Membership</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold">
              Unlock Everything with{" "}
              <span className="text-primary">Neeko+</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Get unlimited access to AI-powered insights, advanced analytics,
              and premium features across all sports
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <Card className="max-w-2xl mx-auto p-8 md:p-12 bg-gradient-to-br from-primary/10 to-transparent border-2 border-primary shadow-xl">
            <div className="text-center space-y-6">
              <Crown className="h-20 w-20 text-primary mx-auto" />

              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-2">
                  Neeko+ Premium
                </h2>
                <p className="text-muted-foreground">
                  Professional sports analytics platform
                </p>
              </div>

              <div className="py-6">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl md:text-6xl font-extrabold text-primary">
                    $5.99
                  </span>
                  <span className="text-2xl text-muted-foreground font-semibold">
                    /week
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Cancel anytime, no commitment
                </p>
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={loading}
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-12 py-6 font-bold"
              >
                {loading ? (
                  <>
                    <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="h-5 w-5 mr-2" />
                    Get Neeko+ Now
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
                <Shield className="h-4 w-4" />
                <span>Secure payment via Stripe</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              What's Included
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Everything you need for professional-grade sports analytics
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {premiumFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={index}
                    className="p-6 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Premium Benefits
            </h2>

            <Card className="p-8">
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-lg">{benefit}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Full Coverage Across All Sports
            </h2>
            <p className="text-xl text-muted-foreground">
              Access premium features for AFL, EPL, and NBA with a single
              subscription
            </p>

            <div className="grid md:grid-cols-3 gap-6 pt-8">
              {[
                { sport: "AFL", desc: "Australian Football League" },
                { sport: "EPL", desc: "English Premier League" },
                { sport: "NBA", desc: "National Basketball Association" },
              ].map((item, index) => (
                <Card
                  key={index}
                  className="p-6 bg-background hover:bg-primary/5 transition-all"
                >
                  <h3 className="text-2xl font-bold text-primary mb-2">
                    {item.sport}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-center text-muted-foreground mb-12">
              Common questions about Neeko+ membership
            </p>

            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-2">
                  How does billing work?
                </h3>
                <p className="text-muted-foreground">
                  You'll be charged $5.99 per week. Your subscription
                  automatically renews weekly unless you cancel.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-2">
                  Can I cancel anytime?
                </h3>
                <p className="text-muted-foreground">
                  Yes! You can cancel your subscription at any time from your
                  account settings. No questions asked, no cancellation fees.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-muted-foreground">
                  We accept all major credit cards, debit cards, and digital
                  wallets through our secure Stripe payment processor.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-2">
                  Do I need an account?
                </h3>
                <p className="text-muted-foreground">
                  Yes, you'll need to create a free account to subscribe to
                  Neeko+. This allows us to save your preferences and provide
                  personalized insights.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-muted-foreground">
                  Currently, we don't offer a free trial, but you can cancel
                  within the first week for a full refund if you're not
                  satisfied.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Crown className="h-20 w-20 text-primary mx-auto" />
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to Elevate Your Sports Analytics?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of sports enthusiasts using Neeko+ for
              professional-grade insights
            </p>
            <Button
              onClick={handleSubscribe}
              disabled={loading}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-12 py-6 font-bold"
            >
              {loading ? (
                <>
                  <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Crown className="h-5 w-5 mr-2" />
                  Start Your Neeko+ Subscription
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Cancel anytime • Secure payment • No commitment
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
