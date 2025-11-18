import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function NeekoPlusPurchase() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscribe = async () => {
    setLoading(true);

    try {
      // 1️⃣ Check if user logged in
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth?redirect=/neeko-plus");
        return;
      }

      // 2️⃣ Create checkout session
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: { user_id: user.id },
        }
      );

      if (fnError) throw fnError;

      let url = null;

      if (typeof fnData === "string") {
        url = JSON.parse(fnData).url;
      } else if (typeof fnData === "object") {
        url = fnData.url;
      }

      if (!url) throw new Error("Missing checkout URL");

      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Checkout failed",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });

      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Neeko+</h1>

      <p className="text-lg mb-6">
        Unlock premium sports analytics with Neeko+
      </p>

      <Button onClick={handleSubscribe} disabled={loading}>
        {loading ? "Redirecting…" : "Subscribe Now"}
      </Button>
    </div>
  );
}