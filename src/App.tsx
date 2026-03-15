import React, { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { track } from "@/lib/analytics";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import {
  PlayersPageSkeleton,
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
import {
  AdminShell,
  AdminCommandCenter,
  AdminDashboard,
  AdminSystemHealth,
  AdminOperations,
  AdminAnalytics,
  AdminContentEngine,
  AdminContentPlanner,
  AdminFounderTasks,
} from "@/pages/Admin";

const NeekoPlusPurchase = React.lazy(() => import("@/pages/NeekoPlusPurchase"));
const Account           = React.lazy(() => import("@/pages/Account"));
const Billing           = React.lazy(() => import("@/pages/Billing"));
const About             = React.lazy(() => import("@/pages/About"));
const Socials           = React.lazy(() => import("@/pages/Socials"));
const FAQ               = React.lazy(() => import("@/pages/FAQ"));
const Contact           = React.lazy(() => import("@/pages/Contact"));
const AdminQueue        = React.lazy(() => import("@/pages/AdminQueue"));
const PipelineHistory        = React.lazy(() => import("@/pages/PipelineHistory"));
const DataPipelineStatusPage = React.lazy(() => import("@/features/admin/DataPipelineStatusPage"));
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
const AFLRankingsPage   = React.lazy(() => import("@/features/afl/rankings/AFLRankingsPage"));
const AFLRoundEdgeBoard = React.lazy(() => import("@/features/afl/edge/AFLRoundEdgeBoard"));
const AFLStartSitPage   = React.lazy(() => import("@/features/afl/start-sit/StartSitPage"));
const AFLMarketWatch    = React.lazy(() => import("@/features/afl/market-watch/MarketWatchPage"));

/* =========================
   Suspense helpers
========================= */
function S({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

const Players = <PlayersPageSkeleton />;
const AI      = <AIInsightsSkeleton />;
const Generic = <GenericPageSkeleton />;

function App() {
  const location = useLocation();

  useEffect(() => {
    track("page_view", { page: location.pathname });
  }, [location.pathname]);

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
          <RequireAdmin>
            <Layout>
              <AdminShell />
            </Layout>
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/admin/command-center" replace />} />
        <Route path="command-center"   element={<S fallback={Generic}><AdminCommandCenter /></S>} />
        <Route path="dashboard"        element={<S fallback={Generic}><AdminDashboard /></S>} />
        <Route path="system-health"    element={<S fallback={Generic}><AdminSystemHealth /></S>} />
        <Route path="operations"       element={<S fallback={Generic}><AdminOperations /></S>} />
        <Route path="analytics"        element={<S fallback={Generic}><AdminAnalytics /></S>} />
        <Route path="content-engine"   element={<S fallback={Generic}><AdminContentEngine /></S>} />
        <Route path="content-planner"  element={<S fallback={Generic}><AdminContentPlanner /></S>} />
        <Route path="founder-tasks"    element={<S fallback={Generic}><AdminFounderTasks /></S>} />
      </Route>

      <Route
        path="/admin/queue"
        element={
          <RequireAdmin>
            <Layout>
              <S fallback={Generic}><AdminQueue /></S>
            </Layout>
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/pipeline-history"
        element={
          <RequireAdmin>
            <Layout>
              <S fallback={Generic}><PipelineHistory /></S>
            </Layout>
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/pipeline-status"
        element={
          <RequireAdmin>
            <Layout>
              <S fallback={Generic}><DataPipelineStatusPage /></S>
            </Layout>
          </RequireAdmin>
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
      <Route path="/policies/conduct"      element={<Layout><S fallback={Generic}><UserConductPolicy /></S></Layout>} />
      <Route path="/policies/user-conduct" element={<Layout><S fallback={Generic}><UserConductPolicy /></S></Layout>} />
      <Route path="/user-conduct-policy"   element={<Layout><S fallback={Generic}><UserConductPolicy /></S></Layout>} />

      {/* =========================
         AFL
      ========================= */}
      <Route path="/sports/afl" element={<Navigate to="/sports/afl/rankings" replace />} />
      <Route path="/sports/afl/rankings"    element={<Layout><S fallback={Players}><AFLRankingsPage /></S></Layout>} />
      <Route path="/sports/afl/neeko-intel" element={<Navigate to="/sports/afl/edge-board" replace />} />
      <Route path="/sports/afl/edge-board"  element={<Layout><S fallback={Generic}><AFLRoundEdgeBoard /></S></Layout>} />
      <Route path="/sports/afl/compare"       element={<Navigate to="/sports/afl/start-sit" replace />} />
      <Route path="/sports/afl/start-sit"    element={<Layout><S fallback={Generic}><AFLStartSitPage /></S></Layout>} />
      <Route path="/sports/afl/market-watch" element={<Layout><S fallback={Generic}><AFLMarketWatch /></S></Layout>} />

      {/* =========================
         Catch-all
      ========================= */}
      <Route path="*" element={<Layout><NotFound /></Layout>} />
    </Routes>
  );
}

export default App;
