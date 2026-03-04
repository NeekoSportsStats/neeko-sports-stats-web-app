import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
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

    // Listen on both subscriptions (user_id AND profile_id columns) plus profiles
    // The webhook trigger may populate either column depending on event type
    const channel = supabase
      .channel(`subscription-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        () => { fetchSubscriptionStatus(); }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `profile_id=eq.${user.id}`
        },
        () => { fetchSubscriptionStatus(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        () => { fetchSubscriptionStatus(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchSubscriptionStatus = async () => {
    if (!user) {
      setStatus("free");
      return;
    }

    try {
      // Check subscriptions table — match on either user_id or profile_id
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .or(`user_id.eq.${user.id},profile_id.eq.${user.id}`)
        .order('current_period_end', { ascending: false })
        .limit(1);

      if (error) throw error;

      const subscription = subscriptions?.[0] ?? null;

      if (!subscription) {
        // Fall back to profiles.subscription_status
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_status, current_period_end, is_active')
          .eq('id', user.id)
          .maybeSingle();

        const now = new Date();
        const periodEnd = profile?.current_period_end
          ? new Date(profile.current_period_end)
          : null;
        const notExpired = periodEnd !== null && periodEnd > now;

        const statusOk =
          profile?.subscription_status === 'active' ||
          profile?.subscription_status === 'trialing' ||
          profile?.is_active === true;

        if (statusOk && notExpired) {
          setStatus((profile.subscription_status ?? 'active') as SubscriptionStatus);
        } else {
          setStatus("free");
          setSubscriptionData(null);
        }
        return;
      }

      setSubscriptionData(subscription);

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end)
          : null;
        if (!periodEnd || periodEnd > new Date()) {
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
