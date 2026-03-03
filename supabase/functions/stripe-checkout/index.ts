import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const stripe = new Stripe(stripeSecret, {
  appInfo: { name: 'Neeko Sports Stats', version: '1.0.0' },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function ok(body: object) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400, extra?: object) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  try {
    if (!stripeSecret || !stripeSecret.startsWith('sk_')) {
      console.error('stripe-checkout: STRIPE_SECRET_KEY missing or invalid format');
      return err('Stripe is not configured', 500);
    }

    const body = await req.json().catch(() => ({}));
    const { plan, price_id: rawPriceId, success_url, cancel_url, mode } = body;

    if (!success_url || typeof success_url !== 'string') {
      return err('Missing required parameter: success_url');
    }
    if (!cancel_url || typeof cancel_url !== 'string') {
      return err('Missing required parameter: cancel_url');
    }
    if (mode !== 'subscription' && mode !== 'payment') {
      return err('Invalid mode — must be "subscription" or "payment"');
    }

    let price_id: string | undefined = rawPriceId;

    if (plan === 'monthly' || plan === 'yearly') {
      const { data: planRow, error: planErr } = await supabase
        .from('stripe_products_config')
        .select('price_id')
        .eq('plan_key', plan)
        .maybeSingle();

      if (planErr) {
        console.error('stripe-checkout: failed to load plan config', planErr);
      }

      if (planRow?.price_id) {
        price_id = planRow.price_id;
        console.log(`stripe-checkout: resolved ${plan} price from DB: ${price_id}`);
      }
    }

    if (!price_id || typeof price_id !== 'string') {
      return err('Missing required parameter: price_id');
    }

    console.log('stripe-checkout: inputs', {
      mode,
      plan,
      price_id,
      success_url,
      cancel_url,
      keyMode: stripeSecret.startsWith('sk_live_') ? 'live' : 'test',
    });

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return err('Missing Authorization header', 401);
    }

    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      console.error('stripe-checkout: auth failed', getUserError);
      return err('Failed to authenticate user', 401);
    }

    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (getCustomerError) {
      console.error('stripe-checkout: failed to fetch customer', getCustomerError);
      return err('Failed to fetch customer information', 500);
    }

    let customerId: string;

    if (!customer?.customer_id) {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      console.log(`stripe-checkout: created Stripe customer ${newCustomer.id} for user ${user.id}`);

      const { error: createCustomerError } = await supabase
        .from('stripe_customers')
        .insert({ user_id: user.id, customer_id: newCustomer.id });

      if (createCustomerError) {
        console.error('stripe-checkout: failed to save customer', createCustomerError);
        try {
          await stripe.customers.del(newCustomer.id);
        } catch (_) { /* ignore cleanup errors */ }
        return err('Failed to create customer record', 500);
      }

      if (mode === 'subscription') {
        const { error: subErr } = await supabase
          .from('stripe_subscriptions')
          .insert({ customer_id: newCustomer.id, status: 'not_started' });

        if (subErr) {
          console.error('stripe-checkout: failed to create subscription record', subErr);
          try {
            await stripe.customers.del(newCustomer.id);
          } catch (_) { /* ignore */ }
          return err('Failed to create subscription record', 500);
        }
      }

      customerId = newCustomer.id;
    } else {
      customerId = customer.customer_id;

      if (mode === 'subscription') {
        const { data: sub, error: subErr } = await supabase
          .from('stripe_subscriptions')
          .select('status')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (subErr) {
          console.error('stripe-checkout: failed to fetch subscription', subErr);
          return err('Failed to fetch subscription information', 500);
        }

        if (!sub) {
          const { error: createSubErr } = await supabase
            .from('stripe_subscriptions')
            .insert({ customer_id: customerId, status: 'not_started' });

          if (createSubErr) {
            console.error('stripe-checkout: failed to create sub record for existing customer', createSubErr);
            return err('Failed to create subscription record', 500);
          }
        }
      }
    }

    console.log('stripe-checkout: creating session', { customerId, price_id });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      payment_method_collection: 'always',
    });

    console.log(`stripe-checkout: session created ${session.id}`);

    return ok({ sessionId: session.id, url: session.url });
  } catch (e: any) {
    console.error('stripe-checkout: unhandled error', {
      message: e?.message,
      type: e?.type,
      code: e?.code,
      param: e?.param,
      statusCode: e?.statusCode,
      stack: e?.stack,
    });

    return err(e?.message ?? 'Internal server error', 500, {
      type: e?.type ?? null,
      code: e?.code ?? null,
      param: e?.param ?? null,
    });
  }
});
