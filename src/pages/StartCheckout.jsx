import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StartCheckout() {
  useEffect(() => {
    const go = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        "https://zbomenuickrogthnsozb.functions.supabase.co/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            priceId: import.meta.env.VITE_STRIPE_PRICE_ID,
          }),
        }
      );

      const data = await res.json();
      if (data.url) window.location.href = data.url;
    };

    go();
  }, []);

  return <p className="p-6 text-center">Redirecting to secure checkout…</p>;
}
