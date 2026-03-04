import posthog from "posthog-js";
import { supabase } from "@/lib/supabaseClient";

export function initAnalytics() {
  if (typeof window === "undefined") return;

  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key || key === "your_posthog_project_key") return;

  posthog.init(key, {
    api_host: "https://app.posthog.com",
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
      .then(() => {});
  });
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    posthog.identify(userId, traits);
  } catch {
    // silently ignore
  }
}
