import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";

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
const AFLPlayersPage    = React.lazy(() => import("@/features/afl/players/AFLPlayersPage"));
const AFLTeamsPage      = React.lazy(() => import("@/features/afl/teams/AFLTeamsPage"));
const AFLMatchCentrePage = React.lazy(() => import("@/features/afl/match-centre/AFLMatchCentrePage"));
const AFLAIInsightsPage = React.lazy(() => import("@/features/afl/ai-insights/AFLAIInsightsPage"));

/* =========================
   EPL Pages — lazy
========================= */
const EPLPlayers        = React.lazy(() => import("@/pages/sports/epl/EPLPlayers"));
const EPLTeams          = React.lazy(() => import("@/pages/sports/epl/EPLTeams"));
const EPLAIInsights     = React.lazy(() => import("@/pages/sports/epl/EPLAIInsights"));
const EPLMatchCentre    = React.lazy(() => import("@/pages/sports/epl/EPLMatchCentre"));

/* =========================
   NBA Pages — lazy
========================= */
const NBAPlayers        = React.lazy(() => import("@/pages/sports/nba/NBAPlayers"));
const NBATeams          = React.lazy(() => import("@/pages/sports/nba/NBATeams"));
const NBAAIInsights     = React.lazy(() => import("@/pages/sports/nba/NBAAIInsights"));
const NBAMatchCentre    = React.lazy(() => import("@/pages/sports/nba/NBAMatchCentre"));

/* =========================
   Shared page loading fallback
========================= */
function PageLoader() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* =========================
           Auth & Checkout
        ========================= */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/create-password" element={<CreatePassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/start-checkout" element={<StartCheckout />} />

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
              <NeekoPlusPurchase />
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
                <Account />
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/billing"
          element={
            <RequireAuth>
              <Layout>
                <Billing />
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Layout>
                <Admin />
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/admin/queue"
          element={
            <RequireAuth>
              <Layout>
                <AdminQueue />
              </Layout>
            </RequireAuth>
          }
        />

        {/* =========================
           Success / Cancel
        ========================= */}
        <Route path="/success" element={<Success />} />
        <Route path="/cancel" element={<Cancel />} />

        {/* =========================
           Info
        ========================= */}
        <Route path="/about" element={<Layout><About /></Layout>} />
        <Route path="/socials" element={<Layout><Socials /></Layout>} />
        <Route path="/faq" element={<Layout><FAQ /></Layout>} />
        <Route path="/contact" element={<Layout><Contact /></Layout>} />

        {/* =========================
           Policies
        ========================= */}
        <Route path="/policies" element={<Layout><Policies /></Layout>} />
        <Route path="/policies/privacy" element={<Layout><PrivacyPolicy /></Layout>} />
        <Route path="/policies/refund" element={<Layout><RefundPolicy /></Layout>} />
        <Route path="/policies/security" element={<Layout><SecurityPolicy /></Layout>} />
        <Route path="/policies/terms" element={<Layout><TermsConditions /></Layout>} />
        <Route path="/policies/user-conduct" element={<Layout><UserConductPolicy /></Layout>} />

        {/* =========================
           AFL
        ========================= */}
        <Route path="/sports/afl" element={<Navigate to="/sports/afl/players" replace />} />
        <Route path="/sports/afl/players" element={<Layout><AFLPlayersPage /></Layout>} />
        <Route path="/sports/afl/teams" element={<Layout><AFLTeamsPage /></Layout>} />
        <Route path="/sports/afl/ai-analysis" element={<Layout><AFLAIInsightsPage /></Layout>} />
        <Route path="/sports/afl/match-centre" element={<Layout><AFLMatchCentrePage /></Layout>} />

        {/* =========================
           EPL
        ========================= */}
        <Route path="/sports/epl" element={<Navigate to="/sports/epl/players" replace />} />
        <Route path="/sports/epl/players" element={<Layout><EPLPlayers /></Layout>} />
        <Route path="/sports/epl/teams" element={<Layout><EPLTeams /></Layout>} />
        <Route path="/sports/epl/ai-analysis" element={<Layout><EPLAIInsights /></Layout>} />
        <Route path="/sports/epl/match-centre" element={<Layout><EPLMatchCentre /></Layout>} />

        {/* =========================
           NBA
        ========================= */}
        <Route path="/sports/nba" element={<Navigate to="/sports/nba/players" replace />} />
        <Route path="/sports/nba/players" element={<Layout><NBAPlayers /></Layout>} />
        <Route path="/sports/nba/teams" element={<Layout><NBATeams /></Layout>} />
        <Route path="/sports/nba/ai-analysis" element={<Layout><NBAAIInsights /></Layout>} />
        <Route path="/sports/nba/match-centre" element={<Layout><NBAMatchCentre /></Layout>} />

        {/* =========================
           Catch-all
        ========================= */}
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </Suspense>
  );
}

export default App;
