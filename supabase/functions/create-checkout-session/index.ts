async function handleSubscribe() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    alert("You must be logged in to subscribe.");
    return;
  }

  const res = await fetch(
    "https://zbomenuickrogthnsozb.functions.supabase.co/create-checkout-session",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        priceId: import.meta.env.VITE_STRIPE_PRICE_ID,
      }),
    }
  );

  const data = await res.json();

  if (!data.url) {
    alert("Unable to start checkout");
    return;
  }

  window.location.href = data.url;
}
