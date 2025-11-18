import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  useEffect(() => {
    console.log("Stripe session ID:", sessionId);
    // OPTIONAL: call Supabase to verify subscription
  }, [sessionId]);

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>🎉 Payment Successful</h1>
      <p>Thank you for subscribing to <strong>NEEKO+</strong>.</p>
      <p>
        A confirmation email has been sent to your inbox. Please also check your
        spam or junk folder. Once confirmed, you’ll receive full access to all
        AI-powered analysis tools.
      </p>
    </div>
  );
}
