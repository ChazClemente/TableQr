// No external imports needed!

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {
    name: 'HMAC', hash: 'SHA-256'
  }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const ok = (msg: string) => new Response(msg, { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET');
  if (!secret) return new Response('Not configured', { status: 500 });

  const raw = await req.text();

  const header = req.headers.get('paymongo-signature') ?? '';
  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const i = piece.indexOf('=');
    if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }

  const expected = await hmacHex(secret, `${parts['t'] ?? ''}.${raw}`);
  const valid = [parts['te'], parts['li']].some((s) => !!s && safeEqual(s, expected));

  if (!valid) {
    console.error('SIGNATURE VERIFICATION FAILED');
    return new Response('Invalid signature', { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const type = event?.data?.attributes?.type;
  console.log("WEBHOOK RECEIVED:", type);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  const rest = async (path: string, method = 'GET', body?: unknown) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) console.error(`REST ${method} ${path} -> ${res.status}`, await res.text());
    return res;
  };

  // ─── 1. TEAMMATE'S QR MODULE (Checkout Sessions) ──────────────────────────
  if (type === 'checkout_session.payment.paid') {
    const session = event?.data?.attributes?.data;
    const sessionId = session?.id;
    const amount = session?.attributes?.payments?.[0]?.attributes?.amount;

    if (!sessionId) return ok('no session id');

    await rest('rpc/mark_payment_paid', 'POST', {
      p_provider_ref: sessionId,
      p_amount_centavos: typeof amount === 'number' ? amount : null
    });
    return ok('done');
  }

  // ─── 2. YOUR POS MODULE (Payment Intents / QR Ph) ─────────────────────────
  if (type === 'payment.paid') {
    const payment = event?.data?.attributes?.data;
    const paymentId = payment?.id; // pay_...
    const intentId = payment?.attributes?.payment_intent_id; // pi_...

    if (!intentId) return ok('not a POS payment');

    const secretKey = Deno.env.get('PAYMONGO_SECRET_KEY') ?? '';
    const intentRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${intentId}`, {
      headers: { Authorization: 'Basic ' + btoa(secretKey + ':') },
    });
    const intentData = await intentRes.json();
    const orderId = intentData?.data?.attributes?.metadata?.billId;

    if (!orderId) {
      console.error('No billId in intent metadata:', intentId, JSON.stringify(intentData?.data?.attributes?.metadata));
      return ok('no billId');
    }

    // find the bill of this order
    const billRes = await rest(`bill?order_id=eq.${orderId}&select=bill_id,total_amount,bill_status`);
    const bills = billRes.ok ? await billRes.json() : [];
    const bill = bills.find((b: any) => b.bill_status !== 'paid') ?? bills[0];
    if (!bill) {
      console.error(`No bill found for order ${orderId}`);
      return ok('bill not found');
    }

    // PayMongo retries webhooks, so skip if we already saved this payment
    const dup = await rest(`payment?payment_reference=eq.${paymentId}&select=payment_id`);
    if (dup.ok && (await dup.json()).length > 0) return ok('already processed');

    const r1 = await rest(`bill?bill_id=eq.${bill.bill_id}`, 'PATCH', { bill_status: 'paid' });
    const r2 = await rest(`orders?order_id=eq.${orderId}`, 'PATCH', { order_status: 'completed' });
    const r3 = await rest('payment', 'POST', {
      bill_id: bill.bill_id,
      payment_method: 'gcash', 
      payment_reference: paymentId, // Assuming this column exists or update to match your schema
      payment_status: 'completed',
      paid_at: new Date().toISOString(),
    });

    if (!r1.ok || !r2.ok || !r3.ok) return new Response('db update failed', { status: 500 });

    console.log(`Bill ${bill.bill_id} (order ${orderId}) marked as paid.`);
    return ok('done');
  }

  return ok('ignored');
});