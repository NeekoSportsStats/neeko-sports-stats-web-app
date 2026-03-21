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

    console.log(`Received event: ${event.type} [${event.id}]`);

    await supabase.from('stripe_webhook_events').insert({
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

    EdgeRuntime.waitUntil(handleEvent(event));

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Unhandled webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
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
      await deactivateProfile(userId, customerId);
    }
    return;
  }

  const subscription = subscriptions.data[0];
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

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

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        is_active: isActive,
        plan: isActive ? 'premium' : 'free',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_tier: isActive ? 'premium' : 'free',
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    console.error('profiles upsert error:', profileError);
  } else {
    console.log(`profiles upserted: user=${userId}, is_active=${isActive}, plan=${isActive ? 'premium' : 'free'}`);
  }

  const { error: subTableError } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      profile_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );

  if (subTableError) {
    console.error('subscriptions upsert error:', subTableError);
  } else {
    console.log(`subscriptions table updated for user: ${userId}`);
  }
}

async function deactivateCustomer(customerId: string) {
  console.log(`Deactivating customer: ${customerId}`);

  await supabase
    .from('stripe_subscriptions')
    .upsert({ customer_id: customerId, status: 'canceled' }, { onConflict: 'customer_id' });

  const userId = await resolveUserId(customerId);
  if (userId) {
    await deactivateProfile(userId, customerId);
  }
}

async function deactivateProfile(userId: string, customerId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_active: false,
      plan: 'free',
      subscription_status: 'canceled',
      subscription_tier: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

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

async function resolveUserId(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('stripe_customers')
    .select('user_id, profile_id')
    .or(`customer_id.eq.${customerId},stripe_id.eq.${customerId}`)
    .maybeSingle();

  if (error) {
    console.error('resolveUserId query error:', error);
    return null;
  }

  return data?.user_id ?? data?.profile_id ?? null;
}
