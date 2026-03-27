import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  appInfo: { name: 'NeekoSports', version: '1.0.0' },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400, headers: corsHeaders });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(`Signature verification failed: ${err.message}`, { status: 400, headers: corsHeaders });
    }

    console.log(`Webhook event: ${event.type} [${event.id}]`);

    await supabase.from('stripe_webhook_events').insert({
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    }).then(({ error }) => {
      if (error) console.warn('Failed to log webhook event:', error.message);
    });

    EdgeRuntime.waitUntil(handleEvent(event));

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Unhandled webhook error:', err);
    return new Response(JSON.stringify({ error: 'Request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleEvent(event: Stripe.Event) {
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.customer) {
          await syncCustomerFromStripe(session.customer as string);
        }
        break;
      }
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.customer) {
          await syncCustomerFromStripe(sub.customer as string);
          await trackAnalyticsEvent('subscription_created', null, {
            customer_id: sub.customer as string,
            plan: sub.items?.data?.[0]?.price?.id ?? null,
            status: sub.status,
            interval: sub.items?.data?.[0]?.price?.recurring?.interval ?? null,
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.customer) {
          await syncCustomerFromStripe(sub.customer as string);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await syncCustomerFromStripe(invoice.customer as string);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.customer) {
          await deactivateCustomer(sub.customer as string);
        }
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`Error handling event ${event.type}:`, err);
  }
}

async function resolveUserId(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) {
    console.error('resolveUserId query error:', error);
  }

  if (data?.user_id) return data.user_id;

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (profileError) {
    console.error('resolveUserId profiles fallback error:', profileError);
  }

  return profileData?.id ?? null;
}

async function isManualPremium(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_manual_premium, manual_premium_expires_at')
    .eq('id', userId)
    .maybeSingle();

  if (!data?.is_manual_premium) return false;
  if (!data.manual_premium_expires_at) return true;
  return new Date(data.manual_premium_expires_at) > new Date();
}

async function syncCustomerFromStripe(customerId: string) {
  console.log(`Syncing customer: ${customerId}`);

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  const userId = await resolveUserId(customerId);

  if (subscriptions.data.length === 0) {
    console.log(`No subscriptions found for customer: ${customerId}`);
    await supabase
      .from('stripe_subscriptions')
      .upsert({ customer_id: customerId, status: 'not_started' }, { onConflict: 'customer_id' });

    if (userId) {
      const manualOverride = await isManualPremium(userId);
      if (!manualOverride) {
        await deactivateProfile(userId, customerId);
      } else {
        console.log(`Skipping deactivation for manual premium user: ${userId}`);
      }
    }
    return;
  }

  const subscription = subscriptions.data[0];
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
    {
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: subscription.items.data[0]?.price?.id ?? null,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
      ...(subscription.default_payment_method &&
      typeof subscription.default_payment_method !== 'string'
        ? {
            payment_method_brand: (subscription.default_payment_method as Stripe.PaymentMethod).card?.brand ?? null,
            payment_method_last4: (subscription.default_payment_method as Stripe.PaymentMethod).card?.last4 ?? null,
          }
        : {}),
    },
    { onConflict: 'customer_id' }
  );

  if (subError) {
    console.error('stripe_subscriptions upsert error:', subError);
  } else {
    console.log(`stripe_subscriptions updated for customer: ${customerId}, status: ${subscription.status}`);
  }

  if (!userId) {
    console.warn(`Could not resolve user for customer: ${customerId} — profile not updated`);
    return;
  }

  // Guard: never downgrade a manual premium user
  const manualOverride = await isManualPremium(userId);
  if (manualOverride && !isActive) {
    console.log(`Skipping profile downgrade for manual premium user: ${userId}`);
    return;
  }

  // Update profile using the actual profiles schema columns
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        premium_expires_at: isActive ? periodEnd : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    console.error('profiles upsert error:', profileError);
  } else {
    console.log(`profiles updated: user=${userId}, subscription_status=${subscription.status}`);
  }

  // Also sync the subscriptions table
  const { error: subTableError } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      profile_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  ).then(({ error }) => {
    if (error) console.warn('subscriptions upsert (non-fatal):', error.message);
    else console.log(`subscriptions table updated for user: ${userId}`);
    return { error };
  });

  void subTableError;
}

async function deactivateCustomer(customerId: string) {
  console.log(`Deactivating customer: ${customerId}`);

  await supabase
    .from('stripe_subscriptions')
    .upsert({ customer_id: customerId, status: 'canceled' }, { onConflict: 'customer_id' });

  const userId = await resolveUserId(customerId);
  if (userId) {
    const manualOverride = await isManualPremium(userId);
    if (!manualOverride) {
      await deactivateProfile(userId, customerId);
    } else {
      console.log(`Skipping cancellation deactivation for manual premium user: ${userId}`);
    }
  }
}

async function deactivateProfile(userId: string, _customerId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      premium_expires_at: null,
      billing_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('is_manual_premium', false);

  if (error) {
    console.error(`Failed to deactivate profile for user ${userId}:`, error);
  } else {
    console.log(`Profile deactivated for user: ${userId}`);
  }
}

async function trackAnalyticsEvent(
  eventName: string,
  userId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase
      .schema('analytics' as never)
      .from('events' as never)
      .insert({
        event_name: eventName,
        user_id: userId ?? null,
        session_id: null,
        page: null,
        metadata,
      } as never);
    if (error) {
      console.warn(`[analytics] trackAnalyticsEvent(${eventName}) failed:`, error.message);
    }
  } catch (err: any) {
    console.warn(`[analytics] trackAnalyticsEvent(${eventName}) threw:`, err?.message);
  }
}
