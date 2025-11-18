import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function RefundPolicy() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/policies")}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Policies
      </Button>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Refund Policy</h1>
        <p className="text-muted-foreground text-lg">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Overview</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Neeko's Sports Stats uses Stripe as our secure payment processor for all Neeko+ subscriptions. All billing, payment processing, and transaction security are handled through Stripe's PCI-compliant infrastructure.
            </p>
            <p className="mt-3">
              Refunds are handled on a case-by-case basis according to the guidelines outlined in this policy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Subscription Billing</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Neeko+ subscriptions are billed weekly at $5.99 per billing cycle:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Billing occurs automatically at the start of each weekly cycle</li>
              <li>Subscriptions automatically renew unless canceled before the next billing date</li>
              <li>You will receive a receipt via email after each successful payment</li>
              <li>Payment is processed through Stripe using your saved payment method</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Cancellation Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-3">
            <p>
              You may cancel your Neeko+ subscription at any time:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Navigate to your Account Settings</li>
              <li>Select "Manage Subscription"</li>
              <li>Click "Cancel Subscription"</li>
            </ul>
            <p className="mt-3 font-semibold">
              Important cancellation details:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cancellation stops future billing immediately</li>
              <li>You retain premium access until the end of your current billing period</li>
              <li>No prorated refunds are issued for the remaining days in your current billing cycle</li>
              <li>You can resubscribe at any time</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Refund Eligibility</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-3">
            <p>
              Refunds are not provided for standard subscription cancellations. However, we review refund requests on a case-by-case basis for the following situations:
            </p>
            
            <div className="mt-4">
              <h4 className="font-semibold mb-2 text-green-600">Eligible for Refund Review:</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Accidental duplicate charges due to technical errors</li>
                <li>Billing issues caused by platform malfunction</li>
                <li>Unauthorized charges (subject to verification)</li>
                <li>Service outages lasting more than 48 consecutive hours</li>
                <li>Failure to cancel before renewal due to documented technical issues with the cancellation process</li>
              </ul>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold mb-2 text-red-600">Not Eligible for Refund:</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Change of mind after subscribing</li>
                <li>Forgetting to cancel before the renewal date</li>
                <li>Not using premium features during the billing period</li>
                <li>Dissatisfaction with AI insights or analytics accuracy</li>
                <li>Partial billing period refunds (unless exceptional circumstances apply)</li>
                <li>Chargebacks or payment disputes initiated without contacting us first</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Requesting a Refund</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              To request a refund:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Contact us at Neekotrading@gmail.com within 14 days of the charge</li>
              <li>Include your account email and transaction date</li>
              <li>Provide a detailed explanation of why you believe a refund is warranted</li>
              <li>Include any supporting evidence (screenshots, error messages, etc.)</li>
            </ul>
            <p className="mt-3">
              Refund requests are reviewed within 5-7 business days. You will receive an email with the decision and next steps.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Refund Processing</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              If your refund request is approved:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Refunds are processed through Stripe to your original payment method</li>
              <li>Processing typically takes 5-10 business days depending on your bank</li>
              <li>You will receive confirmation once the refund is initiated</li>
              <li>Premium access is revoked immediately upon refund approval</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Chargeback Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-3">
            <p className="font-semibold text-destructive">
              Filing a chargeback without contacting us first may result in permanent account termination.
            </p>
            <p>
              If you dispute a charge with your bank or credit card company:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>We will receive notification from Stripe and investigate</li>
              <li>Your account may be suspended pending chargeback resolution</li>
              <li>If the chargeback is found to be fraudulent or unjustified, your account will be permanently banned</li>
              <li>Repeated chargebacks may result in legal action and payment processor blacklisting</li>
            </ul>
            <p className="mt-3">
              We strongly encourage contacting us directly to resolve billing issues before initiating a chargeback.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Exceptional Circumstances</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              In rare cases involving extenuating circumstances (e.g., serious medical emergencies, documented financial hardship, death of the account holder), we may offer partial refunds or billing adjustments at our discretion.
            </p>
            <p className="mt-3">
              Contact us with documentation to request consideration for exceptional circumstances.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. Payment Security</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              All payment information is securely handled by Stripe:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Neeko's Sports Stats does not store full credit card details</li>
              <li>Stripe uses industry-standard encryption and PCI-DSS Level 1 certification</li>
              <li>Your payment data is tokenized and secured according to global security standards</li>
              <li>Stripe complies with international data protection regulations</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>10. Changes to This Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              We reserve the right to update this Refund Policy at any time. Changes will be posted on this page with an updated revision date. Continued use of the Service constitutes acceptance of the updated policy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>11. Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              For refund requests or billing questions:
            </p>
            <p className="mt-3">
              <strong>Email:</strong> Neekotrading@gmail.com<br />
              <strong>Address:</strong> Melbourne, Victoria, Australia
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
