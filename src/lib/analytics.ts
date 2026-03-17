import posthog from "posthog-js";
import { supabase } from "@/lib/supabaseClient";

export function initAnalytics() {
  if (typeof window === "undefined") return;

  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";
  if (!key) return;

  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    persistence: "localStorage",
  });
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    posthog.capture(event, properties);
  } catch {
    // silently ignore posthog failures
  }

  logEvent(event, properties);
}

export function logEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const page = typeof window !== "undefined" ? window.location.pathname : undefined;

  supabase.auth.getUser().then(({ data }) => {
    supabase
      .from("analytics_events")
      .insert({
        event_name: event,
        page,
        user_id: data?.user?.id ?? null,
        properties: properties ?? {},
      })
      .then(({ error }) => {
        if (error) {
          // Silently discard — analytics table may not exist in all environments
        }
      });
  }).catch(() => {});
}

export function identifyUser(user: { id: string; email?: string }) {
  if (typeof window === "undefined") return;
  try {
    if (!user?.id) return;
    posthog.identify(user.id, {
      email: user.email ?? undefined,
    });
  } catch (err) {
    console.warn("PostHog identify failed", err);
  }
}

export function resetUser() {
  if (typeof window === "undefined") return;
  try {
    posthog.reset();
  } catch (err) {
    console.warn("PostHog reset failed", err);
  }
}
