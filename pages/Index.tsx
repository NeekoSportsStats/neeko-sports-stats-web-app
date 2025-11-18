import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Brain, BarChart3, Target, Crown } from "lucide-react";
import heroImage from "@/assets/hero-stadium.png";

const Index = () => {
  const sports = [
    {
      name: "AFL",
      icon: Trophy,
      description: "Australian Football League stats & analytics",
      url: "/sports/afl/players",
      color: "from-red-500/20 to-orange-500/10"
    },
    {
      name: "EPL",
      icon: Target,
      description: "English Premier League insights",
      url: "/sports/epl/players",
      color: "from-purple-500/20 to-pink-500/10"
    },
    {
      name: "NBA",
      icon: BarChart3,
      description: "National Basketball Association analytics",
      url: "/sports/nba/players",
      color: "from-yellow-500/20 to-orange-500/10"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[40vh] md:min-h-[55vh] h-auto flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "scroll",
            backgroundRepeat: "no-repeat",
          }}
        />
        
        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%)"
          }}
        />
        
        {/* Content */}
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 text-white">
            <span className="text-primary">Neeko's Sports Stats</span>
          </h1>
          <p className="text-xl md:text-2xl text-white font-semibold mb-8 max-w-3xl mx-auto">
            Professional-grade analytics across AFL, EPL & NBA
          </p>
          <p className="text-lg text-white/90 mb-12 max-w-2xl mx-auto">
            Real-time player stats, team analysis, AI-powered insights, and match center coverage—all in one platform
          </p>
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-12 py-6 font-bold">
            <Link to="/sports/afl/players">Explore Stats Now</Link>
          </Button>
        </div>
      </section>

      {/* Choose Your Sport */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Choose Your Sport</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Access comprehensive stats, analytics, and AI insights for your favorite league
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {sports.map((sport) => {
              const Icon = sport.icon;
              return (
                <Link key={sport.name} to={sport.url}>
                  <Card className={`p-6 bg-gradient-to-br ${sport.color} border-2 border-primary/20 hover:border-primary transition-all cursor-pointer group h-full`}>
                    <Icon className="h-12 w-12 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-2xl font-bold mb-2 text-center">{sport.name}</h3>
                    <p className="text-sm text-muted-foreground text-center">{sport.description}</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What We Offer</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 text-center hover:bg-primary/5 transition-all">
              <Trophy className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Player Stats</h3>
              <p className="text-sm text-muted-foreground">
                Detailed performance metrics, round-by-round breakdowns, and career statistics
              </p>
            </Card>

            <Card className="p-6 text-center hover:bg-primary/5 transition-all">
              <BarChart3 className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Team Stats</h3>
              <p className="text-sm text-muted-foreground">
                Team performance analysis, aggregated scoring data, and comparative insights
              </p>
            </Card>

            <Card className="p-6 text-center hover:bg-primary/5 transition-all">
              <Brain className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">AI Insights</h3>
              <p className="text-sm text-muted-foreground">
                Machine learning powered trends, hot/cold player detection, and predictive analysis
              </p>
            </Card>

            <Card className="p-6 text-center hover:bg-primary/5 transition-all">
              <Target className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Match Center</h3>
              <p className="text-sm text-muted-foreground">
                Live matchup analysis, head-to-head comparisons, and game-day insights
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Neeko+ Teaser */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-br from-primary/10 to-transparent border-2 border-primary">
            <div className="text-center space-y-6">
              <Crown className="h-16 w-16 text-primary mx-auto" />
              <h2 className="text-3xl md:text-4xl font-bold">Unlock Everything with Neeko+</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get unlimited access to all player stats, team analytics, AI insights, and premium features across all sports for just $5.99/week
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-12 py-6 font-bold">
                  <Link to="/neeko-plus">
                    <Crown className="h-5 w-5 mr-2" />
                    Get Neeko+
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Frequently Asked Questions</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Quick answers to common questions about Neeko's Sports Stats
          </p>
          
          <div className="max-w-4xl mx-auto space-y-4">
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2">What is Neeko's Sports Stats?</h3>
              <p className="text-muted-foreground">
                Neeko's Sports Stats is an analytics platform offering AI-powered insights, player trends, and team statistics across AFL, EPL, and NBA.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2">What is Neeko+?</h3>
              <p className="text-muted-foreground">
                Neeko+ is our premium subscription that unlocks all AI insights, full player trend lists, advanced stats, and removes blurred content.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2">How much does Neeko+ cost?</h3>
              <p className="text-muted-foreground">
                Neeko+ costs $5.99 per week and can be cancelled anytime.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2">Do I need an account to use the site?</h3>
              <p className="text-muted-foreground">
                You can browse some data without an account, but an account is required for Neeko+ and full feature access.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2">How accurate are the AI insights?</h3>
              <p className="text-muted-foreground">
                Our AI models use performance data, trends, and predictive analytics. They are not guarantees but serve as intelligent indicators.
              </p>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
              <Link to="/faq">View All FAQs</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Built for Sports Enthusiasts</h2>
            <p className="text-lg text-foreground leading-relaxed">
              Neeko's Sports Stats delivers professional-grade analytics to fans, fantasy players, analysts, and enthusiasts. 
              Whether you follow AFL, EPL, or NBA, our platform provides the data-driven insights you need to stay ahead of the game.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-secondary">
        <div className="container mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Ready to Explore the Stats?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose your sport and start analyzing player performance, team trends, and AI-powered insights today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Button asChild size="lg" variant="outline" className="text-lg px-12 py-6 font-bold">
              <Link to="/sports/afl/players">Browse AFL</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-12 py-6 font-bold">
              <Link to="/sports/epl/players">Browse EPL</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-12 py-6 font-bold">
              <Link to="/sports/nba/players">Browse NBA</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Neeko's Sports Stats. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <Link to="/policies" className="text-muted-foreground hover:text-primary transition-colors">
                Policies
              </Link>
              <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                Contact
              </Link>
              <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                About
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
