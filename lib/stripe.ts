import { supabase } from "@/integrations/supabase/client";

export async function createCheckoutSession() {
  // Guest checkout - no auth required
  const response = await supabase.functions.invoke("create-checkout-session");

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data.url;
}

export async function createPortalSession() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error("Not authenticated");
  }

  const response = await supabase.functions.invoke("create-portal-session", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data.url;
}
