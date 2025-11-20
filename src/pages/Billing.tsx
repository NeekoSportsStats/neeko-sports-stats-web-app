import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function Billing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Missing portal URL");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-8">
        <Button
          onClick={() => navigate("/account")}
          variant="ghost"
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Button>
        <h1 className="text-4xl font-bold mb-2">Billing Management</h1>
        <p className="text-muted-foreground">
          Manage your payment methods and view billing history
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Customer Portal
          </CardTitle>
          <CardDescription>
            Access the Stripe Customer Portal to manage your subscription,
            update payment methods, view invoices, and cancel if needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">What you can do:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Update your payment method</li>
              <li>• View and download invoices</li>
              <li>• Update billing information</li>
              <li>• Cancel your subscription</li>
              <li>• View payment history</li>
            </ul>
          </div>

          <Button
            onClick={handleManageBilling}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening Billing Portal...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Open Billing Portal
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You'll be redirected to Stripe's secure portal
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
