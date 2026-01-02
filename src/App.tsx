import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";

/* =========================
   Core Pages
========================= */
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import NeekoPlusPurchase from "@/pages/NeekoPlusPurchase";
import Account from "@/pages/Account";
import Billing from "@/pages/Billing";
import About from "@/pages/About";
import Socials from "@/pages/Socials";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Admin from "@/pages/Admin";
import AdminQueue from "@/pages/AdminQueue";
import Success from "@/pages/Success";
import Cancel from "@/pages/Cancel";
import CreatePassword from "@/pages/CreatePassword";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import StartCheckout from "@/pages/StartCheckout";
import NotFound from "@/pages/NotFound";

/* =========================
   Policies
========================= */
import Policies from "@/pages/policies/Policies";
import PrivacyPolicy from "@/pages/policies/PrivacyPolicy";
import RefundPolicy from "@/pages/policies/RefundPolicy";
import SecurityPolicy from "@/pages/policies/SecurityPolicy";
import TermsConditions from "@/pages/policies/TermsConditions";
import UserConductPolicy from "@/pages/policies/UserConductPolicy";

/* =========================
   AFL Pages (Nested)
========================= */
import AFLPlayers from "@/pages/sports/afl/AFLPlayers";
import AFLTeams from "@/pages/sports/afl/AFLTeams";
import AFLAIInsights from "@/pages/sports/afl/AFLAIInsights";
import AFLMatchCentre from "@/pages/sports/afl/AFLMatchCentre";

/* =========================
   EPL Pages (Nested)
========================= */
import EPLPlayers from "@/pages/sports/EPL/EPLPlayers";
import EPLTeams from "@/pages/sports/EPL/EPLTeams";
import EPLCompleteAIAnalysis from "@/pages/sports/EPL/EPLCompleteAIAnalysis";
import EPLMatchCentre from "@/pages/sports/EPL/EPLMatchCentre";

/* =========================
   NBA Pages (Nested)
========================= */
import NBAPlayers from "@/pages/sports/NBA/NBAPlayers";
import NBATeams from "@/pages/sports/NBA/NBATeams";
import NBACompleteAIAnalysis from "@/pages/sports/NBA/NBACompleteAIAnalysis";
import NBAMatchCentre from "@/pages/sports/NBA/NBAMatchCentre";

function App() {
  return (
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
      <Route path="/sports/afl/players" element={<Layout><AFLPlayers /></Layout>} />
      <Route path="/sports/afl/teams" element={<Layout><AFLTeams /></Layout>} />
      <Route path="/sports/afl/ai-analysis" element={<Layout><AFLAIInsights /></Layout>} />
      <Route path="/sports/afl/match-centre" element={<Layout><AFLMatchCentre /></Layout>} />

      {/* =========================
         EPL
      ========================= */}
      <Route path="/sports/epl" element={<Navigate to="/sports/epl/players" replace />} />
      <Route path="/sports/epl/players" element={<Layout><EPLPlayers /></Layout>} />
      <Route path="/sports/epl/teams" element={<Layout><EPLTeams /></Layout>} />
      <Route path="/sports/epl/ai-analysis" element={<Layout><EPLCompleteAIAnalysis /></Layout>} />
      <Route path="/sports/epl/match-centre" element={<Layout><EPLMatchCentre /></Layout>} />

      {/* =========================
         NBA
      ========================= */}
      <Route path="/sports/nba" element={<Navigate to="/sports/nba/players" replace />} />
      <Route path="/sports/nba/players" element={<Layout><NBAPlayers /></Layout>} />
      <Route path="/sports/nba/teams" element={<Layout><NBATeams /></Layout>} />
      <Route path="/sports/nba/ai-analysis" element={<Layout><NBACompleteAIAnalysis /></Layout>} />
      <Route path="/sports/nba/match-centre" element={<Layout><NBAMatchCentre /></Layout>} />

      {/* =========================
         Catch-all
      ========================= */}
      <Route path="*" element={<Layout><NotFound /></Layout>} />
    </Routes>
  );
}

export default App;