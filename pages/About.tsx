import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Users, Sparkles, TrendingUp, Shield, Heart, MessageCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold">About Neeko's Sports Stats</h1>
          <p className="text-xl text-primary font-medium">
            Your edge in every game
          </p>
        </div>

        {/* Overview Section */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <p className="text-muted-foreground leading-relaxed">
            Neeko's Sports Stats is a modern analytics platform built for fans who want more than the basics. 
            Whether users are tracking their fantasy squad, preparing bets, or deep-diving players and teams 
            across AFL, EPL, and NBA, the goal is to deliver smart, fast, and easy-to-understand analytics 
            that provide a real competitive edge.
          </p>
        </Card>

        {/* Mission Section */}
        <Card className="p-8 bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-3">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                To empower every sports fan with professional-level analytics. No jargon. No fluff. 
                Just clear, powerful insights designed to level the playing field for everyone.
              </p>
            </div>
          </div>
        </Card>

        {/* What Makes Us Different Section */}
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center">What Makes Us Different</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Innovation that actually helps</h3>
              </div>
              <p className="text-muted-foreground">
                Our AI identifies patterns, hot streaks, cold trends, player movements, and performance 
                indicators that most people miss. It provides actionable insights rather than just raw stats.
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Quality you can trust</h3>
              </div>
              <p className="text-muted-foreground">
                All data is sourced from reliable feeds and validated for accuracy. Precision matters, 
                especially for fantasy decisions, betting insights, and analytical work.
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Built for real fans</h3>
              </div>
              <p className="text-muted-foreground">
                Neeko's Sports Stats exists because traditional stat pages don't go deep enough. We build tools 
                for people who truly watch and understand the sport, and who want meaningful analysis not found elsewhere.
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Community-first mindset</h3>
              </div>
              <p className="text-muted-foreground">
                Thousands of fans and analysts rely on the platform. The product constantly evolves based on 
                real user feedback and the changing needs of sports analytics.
              </p>
            </Card>
          </div>
        </div>

        {/* Why It Matters Section */}
        <Card className="p-8 text-center bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-4 mb-4">
            <TrendingUp className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Why It Matters</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sports can be unpredictable, but the data tells the story. Neeko's Sports Stats makes complex 
            analytics accessible, fast, and powerful so users can stay ahead of every game.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default About;
