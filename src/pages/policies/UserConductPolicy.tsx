import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function UserConductPolicy() {
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
        <h1 className="text-4xl font-bold mb-2">User Conduct Policy</h1>
        <p className="text-muted-foreground text-lg">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Expected Behavior</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Neeko's Sports Stats is committed to providing a safe, respectful, and productive environment for all users. By using the platform, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Treat all users, staff, and community members with respect</li>
              <li>Use the platform for lawful purposes only</li>
              <li>Maintain the integrity of your account and not share login credentials</li>
              <li>Report bugs, security vulnerabilities, or policy violations to our support team</li>
              <li>Provide accurate information when creating your account</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Prohibited Conduct</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-3">
            <p className="font-semibold">
              The following behaviors are strictly prohibited and may result in immediate account suspension or permanent ban:
            </p>
            
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Abuse and Harassment</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Threatening, abusing, or harassing other users or staff members</li>
                <li>Posting offensive, discriminatory, or hateful content</li>
                <li>Engaging in any form of cyberbullying or stalking</li>
                <li>Impersonating other users, staff, or organizations</li>
              </ul>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold mb-2">Content Misuse</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Scraping, copying, or duplicating platform content for external use</li>
                <li>Republishing Neeko+ premium content publicly or on third-party sites</li>
                <li>Creating derivative works or unauthorized reproductions of our analytics</li>
                <li>Removing watermarks, branding, or attribution from any content</li>
              </ul>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold mb-2">Technical Abuse</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Using bots, scripts, or automated tools to access the platform</li>
                <li>Attempting to bypass paywalls, access restrictions, or security measures</li>
                <li>Reverse-engineering, decompiling, or attempting to extract source code</li>
                <li>Overloading our servers through excessive requests or denial-of-service attacks</li>
              </ul>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold mb-2">Account Violations</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Creating multiple accounts to circumvent restrictions or bans</li>
                <li>Sharing Neeko+ account credentials with non-subscribers</li>
                <li>Engaging in fraudulent activity, including chargeback abuse</li>
                <li>Using stolen payment methods or providing false billing information</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Premium Content Protection</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Neeko+ subscribers have access to exclusive premium content, including advanced AI insights, full player analytics, and trend data. Premium content is provided for personal use only.
            </p>
            <p className="mt-3 font-semibold">
              Prohibited actions include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sharing premium content publicly on social media, forums, or websites</li>
              <li>Distributing screenshots, data exports, or analysis to non-subscribers</li>
              <li>Creating accounts for the purpose of reselling or redistributing premium insights</li>
              <li>Using premium data for commercial purposes without explicit written permission</li>
            </ul>
            <p className="mt-3">
              Violations of premium content protection will result in immediate account termination without refund.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Community Interaction Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              When interacting with analytics, insights, or community features:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be respectful of differing opinions and analytical approaches</li>
              <li>Do not spam, post unsolicited advertisements, or promote external services</li>
              <li>Avoid sharing misleading information or false claims about player performance</li>
              <li>Report inappropriate behavior or content to our moderation team</li>
              <li>Do not manipulate or attempt to game any ranking or recommendation systems</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Legal Compliance</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Users must comply with all applicable local, state, national, and international laws while using Neeko's Sports Stats. This includes but is not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Gambling age restrictions in your jurisdiction</li>
              <li>Intellectual property and copyright laws</li>
              <li>Data protection and privacy regulations</li>
              <li>Anti-fraud and anti-money laundering laws</li>
              <li>Export control and economic sanctions regulations</li>
            </ul>
            <p className="mt-3">
              Users are solely responsible for ensuring their use of the platform complies with all applicable laws.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Reporting Violations</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              If you witness or experience conduct that violates this policy, please report it immediately:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Email: admin@neekostats.com.au</li>
              <li>Include relevant details: date, time, user involved, and description of the violation</li>
              <li>Attach screenshots or evidence if available</li>
            </ul>
            <p className="mt-3">
              All reports are reviewed by our moderation team and handled with confidentiality. We take every report seriously and will investigate thoroughly.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Enforcement and Consequences</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-3">
            <p>
              Violations of this User Conduct Policy may result in the following actions:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Warning:</strong> First-time minor violations may result in an official warning</li>
              <li><strong>Temporary Suspension:</strong> Repeated or moderate violations may result in temporary account suspension (7-30 days)</li>
              <li><strong>Permanent Ban:</strong> Serious violations (fraud, abuse, premium content theft, automated scraping) result in permanent account termination</li>
              <li><strong>Legal Action:</strong> Violations involving illegal activity may be reported to law enforcement</li>
            </ul>
            <p className="mt-3 font-semibold text-destructive">
              Banned users forfeit all subscription benefits without refund.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Appeals Process</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              If you believe your account was suspended or banned in error, you may submit an appeal:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Contact us at admin@neekostats.com.au within 14 days of the action</li>
              <li>Include your account email and a detailed explanation</li>
              <li>Appeals are reviewed within 5-7 business days</li>
              <li>Our decision on appeals is final</li>
            </ul>
            <p className="mt-3">
              Repeated violations after reinstatement will result in permanent ban with no further appeal options.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. Updates to This Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Neeko's Sports Stats reserves the right to update this User Conduct Policy at any time. Changes will be effective immediately upon posting. Continued use of the platform constitutes acceptance of the updated policy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>10. Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              For questions or concerns about this User Conduct Policy:
            </p>
            <p className="mt-3">
              <strong>Email:</strong> admin@neekostats.com.au<br />
              <strong>Address:</strong> Melbourne, Victoria, Australia
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
