import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | "free" | "loading";

export function useSubscriptionStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setStatus("free");
      setSubscriptionData(null);
      return;
    }

    fetchSubscriptionStatus();

    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchSubscriptionStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchSubscriptionStatus = async () => {
    if (!user) {
      setStatus("free");
      return;
    }

    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!subscription) {
        setStatus("free");
        setSubscriptionData(null);
        return;
      }

      setSubscriptionData(subscription);

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        const periodEnd = new Date(subscription.current_period_end);
        if (periodEnd > new Date()) {
          setStatus(subscription.status);
        } else {
          setStatus("canceled");
        }
      } else {
        setStatus(subscription.status as SubscriptionStatus);
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      setStatus("free");
      setSubscriptionData(null);
    }
  };

  const isActive = status === "active" || status === "trialing";
  const isPremium = isActive;

  return {
    status,
    isActive,
    isPremium,
    subscriptionData,
    refresh: fetchSubscriptionStatus
  };
}
