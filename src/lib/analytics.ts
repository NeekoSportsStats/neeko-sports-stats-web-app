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

  try {
    const sessionId = getSessionId();
    const page = (properties?.page as string | undefined) ?? window.location.pathname;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? null;

      const metadata: Record<string, unknown> = {};
      if (properties) {
        for (const [k, v] of Object.entries(properties)) {
          if (k !== "page") metadata[k] = v;
        }
      }

      supabase
        .schema("analytics" as never)
        .from("events" as never)
        .insert({
          event_name: event,
          session_id: sessionId,
          user_id: userId,
          page,
          metadata: Object.keys(metadata).length > 0 ? metadata : {},
        })
        .then(({ error }) => {
          if (error) console.warn("[analytics] logEvent failed:", error.message);
        })
        .catch((e: unknown) => {
          console.warn("[analytics] logEvent threw:", e);
        });
    }).catch((e: unknown) => {
      console.warn("[analytics] getSession failed:", e);
    });
  } catch (e) {
    console.warn("[analytics] logEvent error:", e);
  }
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
