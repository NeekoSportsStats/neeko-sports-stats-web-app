import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/lib/auth";

import { RequireAuth } from "@/components/RequireAuth";

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
import NotFound from "@/pages/NotFound";

import Policies from "@/pages/policies/Policies";
import PrivacyPolicy from "@/pages/policies/PrivacyPolicy";
import RefundPolicy from "@/pages/policies/RefundPolicy";
import SecurityPolicy from "@/pages/policies/SecurityPolicy";
import TermsConditions from "@/pages/policies/TermsConditions";
import UserConductPolicy from "@/pages/policies/UserConductPolicy";

import AFLHub from "@/pages/sports/AFLHub";
import AFLPlayers from "@/pages/sports/AFLPlayers";
import AFLTeams from "@/pages/sports/AFLTeams";
import AFLCompleteAIAnalysis from "@/pages/sports/AFLCompleteAIAnalysis";
import AFLMatchCentre from "@/pages/sports/AFLMatchCentre";

import EPLHub from "@/pages/sports/EPLHub";
import EPLPlayers from "@/pages/sports/EPLPlayers";
import EPLTeams from "@/pages/sports/EPLTeams";
import EPLCompleteAIAnalysis from "@/pages/sports/EPLCompleteAIAnalysis";
import EPLMatchCentre from "@/pages/sports/EPLMatchCentre";

import NBAHub from "@/pages/sports/NBAHub";
import NBAPlayers from "@/pages/sports/NBAPlayers";
import NBATeams from "@/pages/sports/NBATeams";
import NBACompleteAIAnalysis from "@/pages/sports/NBACompleteAIAnalysis";
import NBAMatchCentre from "@/pages/sports/NBAMatchCentre";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public auth-only pages */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/create-password" element={<CreatePassword />} />

        {/* Home */}
        <Route path="/" element={<Layout><Index /></Layout>} />

        {/* Neeko+ purchase is NOT protected */}
        <Route path="/neeko-plus" element={<Layout><NeekoPlusPurchase /></Layout>} />

        {/* Protected routes */}
        <Route path="/account" element={
          <RequireAuth><Layout><Account /></Layout></RequireAuth>
        }/>

        <Route path="/billing" element={
          <RequireAuth><Layout><Billing /></Layout></RequireAuth>
        }/>

        <Route path="/success" element={
          <RequireAuth><Layout><Success /></Layout></RequireAuth>
        }/>

        <Route path="/cancel" element={
          <RequireAuth><Layout><Cancel /></Layout></RequireAuth>
        }/>

        <Route path="/admin" element={
          <RequireAuth><Layout><Admin /></Layout></RequireAuth>
        }/>

        <Route path="/admin/queue" element={
          <RequireAuth><Layout><AdminQueue /></Layout></RequireAuth>
        }/>

        {/* Info */}
        <Route path="/about" element={<Layout><About /></Layout>} />
        <Route path="/socials" element={<Layout><Socials /></Layout>} />
        <Route path="/faq" element={<Layout><FAQ /></Layout>} />
        <Route path="/contact" element={<Layout><Contact /></Layout>} />

        {/* Policies */}
        <Route path="/policies" element={<Layout><Policies /></Layout>} />
        <Route path="/policies/privacy" element={<Layout><PrivacyPolicy /></Layout>} />
        <Route path="/policies/refund" element={<Layout><RefundPolicy /></Layout>} />
        <Route path="/policies/security" element={<Layout><SecurityPolicy /></Layout>} />
        <Route path="/policies/terms" element={<Layout><TermsConditions /></Layout>} />
        <Route path="/policies/user-conduct" element={<Layout><UserConductPolicy /></Layout>} />

        {/* Sports */}
        <Route path="/sports/afl" element={<Layout><AFLHub /></Layout>} />
        <Route path="/sports/afl/players" element={<Layout><AFLPlayers /></Layout>} />
        <Route path="/sports/afl/teams" element={<Layout><AFLTeams /></Layout>} />
        <Route path="/sports/afl/ai-analysis" element={<Layout><AFLCompleteAIAnalysis /></Layout>} />
        <Route path="/sports/afl/match-centre" element={<Layout><AFLMatchCentre /></Layout>} />

        <Route path="/sports/epl" element={<Layout><EPLHub /></Layout>} />
        <Route path="/sports/epl/players" element={<Layout><EPLPlayers /></Layout>} />
        <Route path="/sports/epl/teams" element={<Layout><EPLTeams /></Layout>} />
        <Route path="/sports/epl/ai-analysis" element={<Layout><EPLCompleteAIAnalysis /></Layout>} />
        <Route path="/sports/epl/match-centre" element={<Layout><EPLMatchCentre /></Layout>} />

        <Route path="/sports/nba" element={<Layout><NBAHub /></Layout>} />
        <Route path="/sports/nba/players" element={<Layout><NBAPlayers /></Layout>} />
        <Route path="/sports/nba/teams" element={<Layout><NBATeams /></Layout>} />
        <Route path="/sports/nba/ai-analysis" element={<Layout><NBACompleteAIAnalysis /></Layout>} />
        <Route path="/sports/nba/match-centre" element={<Layout><NBAMatchCentre /></Layout>} />

        {/* Fallback */}
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
