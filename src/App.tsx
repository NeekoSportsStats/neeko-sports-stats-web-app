import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import {
  PlayersPageSkeleton,
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
const AFLMatchCentrePage  = React.lazy(() => import("@/features/afl/match-centre/AFLMatchCentrePage"));
const AFLRankingsPage     = React.lazy(() => import("@/features/afl/rankings/AFLRankingsPage"));
const AFLNeekoIntelPage   = React.lazy(() => import("@/features/afl/neeko-intel/AFLNeekoIntelPage"));

/* =========================
   Suspense helpers
========================= */
function S({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

const Players     = <PlayersPageSkeleton />;
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
      <Route path="/sports/afl" element={<Navigate to="/sports/afl/rankings" replace />} />
      <Route path="/sports/afl/rankings"     element={<Layout><S fallback={Players}><AFLRankingsPage /></S></Layout>} />
      <Route path="/sports/afl/neeko-intel"  element={<Layout><S fallback={AI}><AFLNeekoIntelPage /></S></Layout>} />
      <Route path="/sports/afl/match-centre" element={<Layout><S fallback={MatchCentre}><AFLMatchCentrePage /></S></Layout>} />

      {/* =========================
         Catch-all
      ========================= */}
      <Route path="*" element={<Layout><NotFound /></Layout>} />
    </Routes>
  );
}

export default App;
