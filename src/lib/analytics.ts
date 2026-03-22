import posthog from "posthog-js";
import { supabase } from "@/lib/supabaseClient";

const SESSION_KEY = "neeko_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function initAnalytics() {
  if (typeof window === "undefined") return;

  getSessionId();

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

  const session_id = getSessionId();
  const page = window.location.pathname;

  supabase
    .rpc("log_analytics_event", {
      p_event_name: event,
      p_session_id: session_id,
      p_page: page,
      p_metadata: properties ?? {},
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        console.warn("[analytics] logEvent failed:", error.message);
      }
    });
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
