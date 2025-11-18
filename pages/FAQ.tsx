import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is Neeko's Sports Stats?",
    answer: "Neeko's Sports Stats is an analytics platform offering AI-powered insights, player trends, and team statistics across AFL, EPL, and NBA."
  },
  {
    question: "What is Neeko+?",
    answer: "Neeko+ is our premium subscription that unlocks all AI insights, full player trend lists, advanced stats, and removes blurred content."
  },
  {
    question: "How much does Neeko+ cost?",
    answer: "Neeko+ costs $5.99 per week and can be cancelled anytime."
  },
  {
    question: "Do I need an account to use the site?",
    answer: "You can browse some data without an account, but an account is required for Neeko+ and full feature access."
  },
  {
    question: "How accurate are the AI insights?",
    answer: "Our AI models use performance data, trends, and predictive analytics. They are not guarantees but serve as intelligent indicators."
  },
  {
    question: "Which sports are supported?",
    answer: "We currently support AFL, EPL, and NBA, with more leagues planned for future updates."
  },
  {
    question: "How often are stats updated?",
    answer: "Player and team statistics are updated daily, and AI insights are refreshed as new data becomes available."
  },
  {
    question: "Can I cancel Neeko+ anytime?",
    answer: "Yes. You can cancel your subscription at any time through your account settings."
  },
  {
    question: "Why are some players blurred?",
    answer: "Free users see limited data. Blurred players indicate Neeko+ exclusive content."
  },
  {
    question: "Does Neeko's Sports Stats provide gambling or betting advice?",
    answer: "No. We provide analytics, not financial or betting recommendations."
  },
  {
    question: "Does the platform guarantee predictions?",
    answer: "No predictions are guaranteed. All insights are based on historical and real-time data but are not certainties."
  },
  {
    question: "Do you offer customer support?",
    answer: "Yes. You can contact us via the Contact Us page or email us directly."
  },
  {
    question: "What payment methods do you accept?",
    answer: "All payments are handled securely via Stripe, supporting major debit and credit cards."
  },
  {
    question: "Can I access Neeko+ across multiple devices?",
    answer: "Yes. As long as you're logged in, your subscription works across any device."
  },
  {
    question: "Are refunds available?",
    answer: "Refunds are reviewed case-by-case based on Stripe payment policies."
  },
  {
    question: "Does Neeko's Sports Stats store my personal data?",
    answer: "Only essential account information is stored, and it is protected according to our Privacy Policy."
  },
  {
    question: "Is my payment information safe?",
    answer: "Payments are handled by Stripe, which uses industry-standard encryption and security."
  },
  {
    question: "Will more sports or features be added?",
    answer: "Yes. We are continually expanding the platform and will release updates regularly."
  },
  {
    question: "Why don't I see AI insights for every player?",
    answer: "Some insights require a minimum amount of player data before our system can generate trends."
  },
  {
    question: "What should I do if I find a bug?",
    answer: "Please report it through the Contact Us page so we can fix it in upcoming updates."
  },
];

export default function FAQ() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={handleBack}
        className="mb-6 hover:bg-primary/10"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground text-lg">
          Everything you need to know about Neeko's Sports Stats
        </p>
      </div>

      <Card className="p-6">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left font-semibold">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
