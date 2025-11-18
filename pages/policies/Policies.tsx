import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Shield, Users, DollarSign, Lock, ArrowLeft } from "lucide-react";

const policyCategories = [
  {
    title: "Terms & Conditions",
    description: "Platform usage rules, prohibited activities, and legal agreements",
    icon: FileText,
    url: "/policies/terms",
    color: "from-blue-500/10 to-blue-600/5"
  },
  {
    title: "Privacy Policy",
    description: "How we collect, store, and protect your personal information",
    icon: Shield,
    url: "/policies/privacy",
    color: "from-green-500/10 to-green-600/5"
  },
  {
    title: "User Conduct Policy",
    description: "Expected behavior, community guidelines, and acceptable use",
    icon: Users,
    url: "/policies/conduct",
    color: "from-purple-500/10 to-purple-600/5"
  },
  {
    title: "Refund Policy",
    description: "Subscription cancellation, refund eligibility, and billing terms",
    icon: DollarSign,
    url: "/policies/refund",
    color: "from-orange-500/10 to-orange-600/5"
  },
  {
    title: "Data Handling & Security",
    description: "Security measures, data retention, and protection standards",
    icon: Lock,
    url: "/policies/security",
    color: "from-red-500/10 to-red-600/5"
  }
];

export default function Policies() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Policies</h1>
        <p className="text-muted-foreground text-lg">
          Important information about using Neeko's Sports Stats
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {policyCategories.map((policy) => {
          const Icon = policy.icon;
          return (
            <Link key={policy.title} to={policy.url}>
              <Card className={`p-6 bg-gradient-to-br ${policy.color} border-2 hover:border-primary/50 transition-all cursor-pointer group h-full`}>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                      {policy.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {policy.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <Card className="p-6 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            For questions about our policies, contact us at{" "}
            <a href="mailto:Neekotrading@gmail.com" className="text-primary hover:underline">
              Neekotrading@gmail.com
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}
