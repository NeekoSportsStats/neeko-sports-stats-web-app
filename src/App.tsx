import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import {
  PlayersPageSkeleton,
  TeamsPageSkeleton,
  MatchCentreSkeleton,
  AIInsightsSkeleton,
  GenericPageSkeleton,
} from "@/components/skeletons/PageSkeletons";

/* =========================
   Critical / always-needed (keep static)
========================= */
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";

/* =========================
   Core Pages — lazy
========================= */
const NeekoPlusPurchase = React.lazy(() => import("@/pages/NeekoPlusPurchase"));
const Account           = React.lazy(() => import("@/pages/Account"));
const Billing           = React.lazy(() => import("@/pages/Billing"));
const About             = React.lazy(() => import("@/pages/About"));
const Socials           = React.lazy(() => import("@/pages/Socials"));
const FAQ               = React.lazy(() => import("@/pages/FAQ"));
const Contact           = React.lazy(() => import("@/pages/Contact"));
const Admin             = React.lazy(() => import("@/pages/Admin"));
const AdminQueue        = React.lazy(() => import("@/pages/AdminQueue"));
const Success           = React.lazy(() => import("@/pages/Success"));
const Cancel            = React.lazy(() => import("@/pages/Cancel"));
const CreatePassword    = React.lazy(() => import("@/pages/CreatePassword"));
const ForgotPassword    = React.lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword     = React.lazy(() => import("@/pages/ResetPassword"));
const StartCheckout     = React.lazy(() => import("@/pages/StartCheckout"));

/* =========================
   Policies — lazy
========================= */
const Policies          = React.lazy(() => import("@/pages/policies/Policies"));
const PrivacyPolicy     = React.lazy(() => import("@/pages/policies/PrivacyPolicy"));
const RefundPolicy      = React.lazy(() => import("@/pages/policies/RefundPolicy"));
const SecurityPolicy    = React.lazy(() => import("@/pages/policies/SecurityPolicy"));
const TermsConditions   = React.lazy(() => import("@/pages/policies/TermsConditions"));
const UserConductPolicy = React.lazy(() => import("@/pages/policies/UserConductPolicy"));

/* =========================
   AFL Pages — lazy
========================= */
const AFLPlayersPage     = React.lazy(() => import("@/features/afl/players/AFLPlayersPage"));
const AFLTeamsPage       = React.lazy(() => import("@/features/afl/teams/AFLTeamsPage"));
const AFLMatchCentrePage = React.lazy(() => import("@/features/afl/match-centre/AFLMatchCentrePage"));
const AFLAIInsightsPage  = React.lazy(() => import("@/features/afl/ai-insights/AFLAIInsightsPage"));
const AFLRankingsPage    = React.lazy(() => import("@/features/afl/rankings/AFLRankingsPage"));

/* =========================
   EPL Pages — lazy
========================= */
const EPLPlayers     = React.lazy(() => import("@/pages/sports/epl/EPLPlayers"));
const EPLTeams       = React.lazy(() => import("@/pages/sports/epl/EPLTeams"));
const EPLAIInsights  = React.lazy(() => import("@/pages/sports/epl/EPLAIInsights"));
const EPLMatchCentre = React.lazy(() => import("@/pages/sports/epl/EPLMatchCentre"));

/* =========================
   NBA Pages — lazy
========================= */
const NBAPlayers     = React.lazy(() => import("@/pages/sports/nba/NBAPlayers"));
const NBATeams       = React.lazy(() => import("@/pages/sports/nba/NBATeams"));
const NBAAIInsights  = React.lazy(() => import("@/pages/sports/nba/NBAAIInsights"));
const NBAMatchCentre = React.lazy(() => import("@/pages/sports/nba/NBAMatchCentre"));

/* =========================
   Suspense helpers
========================= */
function S({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

const Players     = <PlayersPageSkeleton />;
const Teams       = <TeamsPageSkeleton />;
const MatchCentre = <MatchCentreSkeleton />;
const AI          = <AIInsightsSkeleton />;
const Generic     = <GenericPageSkeleton />;

function App() {
  return (
    <Routes>
      {/* =========================
         Auth & Checkout
      ========================= */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/create-password" element={<S fallback={Generic}><CreatePassword /></S>} />
      <Route path="/forgot-password" element={<S fallback={Generic}><ForgotPassword /></S>} />
      <Route path="/reset-password"  element={<S fallback={Generic}><ResetPassword /></S>} />
      <Route path="/start-checkout"  element={<S fallback={Generic}><StartCheckout /></S>} />

      {/* =========================
         Home
      ========================= */}
      <Route
        path="/"
        element={
          <Layout>
            <Index />
          </Layout>
        }
      />

      {/* =========================
         Neeko+
      ========================= */}
      <Route
        path="/neeko-plus"
        element={
          <Layout>
            <S fallback={Generic}><NeekoPlusPurchase /></S>
          </Layout>
        }
      />

      {/* =========================
         Protected
      ========================= */}
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Layout>
              <S fallback={Generic}><Account /></S>
            </Layout>
          </RequireAuth>
        }
      />

      <Route
        path="/billing"
        element={
          <RequireAuth>
            <Layout>
              <S fallback={Generic}><Billing /></S>
            </Layout>
          </RequireAuth>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Layout>
              <S fallback={Generic}><Admin /></S>
            </Layout>
          </RequireAuth>
        }
      />

      <Route
        path="/admin/queue"
        element={
          <RequireAuth>
            <Layout>
              <S fallback={Generic}><AdminQueue /></S>
            </Layout>
          </RequireAuth>
        }
      />

      {/* =========================
         Success / Cancel
      ========================= */}
      <Route path="/success" element={<S fallback={Generic}><Success /></S>} />
      <Route path="/cancel"  element={<S fallback={Generic}><Cancel /></S>} />

      {/* =========================
         Info
      ========================= */}
      <Route path="/about"   element={<Layout><S fallback={Generic}><About /></S></Layout>} />
      <Route path="/socials" element={<Layout><S fallback={Generic}><Socials /></S></Layout>} />
      <Route path="/faq"     element={<Layout><S fallback={Generic}><FAQ /></S></Layout>} />
      <Route path="/contact" element={<Layout><S fallback={Generic}><Contact /></S></Layout>} />

      {/* =========================
         Policies
      ========================= */}
      <Route path="/policies"              element={<Layout><S fallback={Generic}><Policies /></S></Layout>} />
      <Route path="/policies/privacy"      element={<Layout><S fallback={Generic}><PrivacyPolicy /></S></Layout>} />
      <Route path="/policies/refund"       element={<Layout><S fallback={Generic}><RefundPolicy /></S></Layout>} />
      <Route path="/policies/security"     element={<Layout><S fallback={Generic}><SecurityPolicy /></S></Layout>} />
      <Route path="/policies/terms"        element={<Layout><S fallback={Generic}><TermsConditions /></S></Layout>} />
      <Route path="/policies/user-conduct" element={<Layout><S fallback={Generic}><UserConductPolicy /></S></Layout>} />

      {/* =========================
         AFL
      ========================= */}
      <Route path="/sports/afl" element={<Navigate to="/sports/afl/players" replace />} />
      <Route path="/sports/afl/players"     element={<Layout><S fallback={Players}><AFLPlayersPage /></S></Layout>} />
      <Route path="/sports/afl/teams"       element={<Layout><S fallback={Teams}><AFLTeamsPage /></S></Layout>} />
      <Route path="/sports/afl/ai-analysis" element={<Layout><S fallback={AI}><AFLAIInsightsPage /></S></Layout>} />
      <Route path="/sports/afl/match-centre" element={<Layout><S fallback={MatchCentre}><AFLMatchCentrePage /></S></Layout>} />
      <Route path="/sports/afl/rankings"    element={<Layout><S fallback={Players}><AFLRankingsPage /></S></Layout>} />

      {/* =========================
         EPL
      ========================= */}
      <Route path="/sports/epl" element={<Navigate to="/sports/epl/players" replace />} />
      <Route path="/sports/epl/players"     element={<Layout><S fallback={Players}><EPLPlayers /></S></Layout>} />
      <Route path="/sports/epl/teams"       element={<Layout><S fallback={Teams}><EPLTeams /></S></Layout>} />
      <Route path="/sports/epl/ai-analysis" element={<Layout><S fallback={AI}><EPLAIInsights /></S></Layout>} />
      <Route path="/sports/epl/match-centre" element={<Layout><S fallback={MatchCentre}><EPLMatchCentre /></S></Layout>} />

      {/* =========================
         NBA
      ========================= */}
      <Route path="/sports/nba" element={<Navigate to="/sports/nba/players" replace />} />
      <Route path="/sports/nba/players"     element={<Layout><S fallback={Players}><NBAPlayers /></S></Layout>} />
      <Route path="/sports/nba/teams"       element={<Layout><S fallback={Teams}><NBATeams /></S></Layout>} />
      <Route path="/sports/nba/ai-analysis" element={<Layout><S fallback={AI}><NBAAIInsights /></S></Layout>} />
      <Route path="/sports/nba/match-centre" element={<Layout><S fallback={MatchCentre}><NBAMatchCentre /></S></Layout>} />

      {/* =========================
         Catch-all
      ========================= */}
      <Route path="*" element={<Layout><NotFound /></Layout>} />
    </Routes>
  );
}

export default App;
