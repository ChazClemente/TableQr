// No external imports needed!

const ok = (msg: string) => new Response(msg, { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = await req.text();
  console.log("WEBHOOK RAW PAYLOAD:", raw);

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

  // ─── 1. TEAMMATE'S QR MODULE (Checkout Sessions) ──────────────────────────
  if (type === 'checkout_session.payment.paid') {
    const session = event?.data?.attributes?.data;
    const sessionId = session?.id;
    const amount = session?.attributes?.payments?.[0]?.attributes?.amount;

    if (!sessionId) return ok('no session id');

    await fetch(`${supabaseUrl}/rest/v1/rpc/mark_payment_paid`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_provider_ref: sessionId,
        p_amount_centavos: typeof amount === 'number' ? amount : null
      })
    });
    return ok('done');
  }

  // ─── 2. YOUR POS MODULE (Payment Intents / QR Ph) ─────────────────────────
  // We check for 'payment.paid' AND 'source.chargeable'
  if (type === 'payment.paid' || type === 'source.chargeable') {
    console.log("POS PAYMENT EVENT RECEIVED:", type);
    
    const resourceId = event?.data?.attributes?.data?.id;
    if (!resourceId) return ok('no resource id found');
    
    let orderId = null;

    if (type === 'source.chargeable') {
      // If it's a source, we need to fetch the source to get metadata
      const srcRes = await fetch(`https://api.paymongo.com/v1/sources/${resourceId}`, {
        headers: { 'Authorization': 'Basic ' + btoa(Deno.env.get('PAYMONGO_SECRET_KEY') + ':') },
      });
      const srcData = await srcRes.json();
      orderId = srcData?.data?.attributes?.metadata?.billId;
    } else {
      // If it's a payment intent, fetch the intent to get metadata
      const intentRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${resourceId}`, {
        headers: { 'Authorization': 'Basic ' + btoa(Deno.env.get('PAYMONGO_SECRET_KEY') + ':') },
      });
      const intentData = await intentRes.json();
      orderId = intentData?.data?.attributes?.metadata?.billId;
    }

    if (orderId) {
      console.log(`POS Payment succeeded for Order ID: ${orderId}`);
      
      // 1. Find the exact bill_id using the order_id
      const billRes = await fetch(`${supabaseUrl}/rest/v1/bill?order_id=eq.${orderId}&select=bill_id`, {
        headers
      });
      const billData = await billRes.json();
      const actualBillId = billData?.[0]?.bill_id;

      if (!actualBillId) {
        console.error(`Could not find bill for order ${orderId}`);
        return ok('bill not found');
      }

      console.log(`Found actual Bill ID: ${actualBillId}`);

      // 2. Update bill status using the actual bill_id
      await fetch(`${supabaseUrl}/rest/v1/bill?bill_id=eq.${actualBillId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ bill_status: 'paid' })
      });

      // 3. Update order status
      await fetch(`${supabaseUrl}/rest/v1/orders?order_id=eq.${orderId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ order_status: 'completed' })
      });

      // 4. Insert payment record using the actual bill_id
      await fetch(`${supabaseUrl}/rest/v1/payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bill_id: actualBillId,
          payment_method: 'gcash', 
          payment_status: 'completed',
        })
      });

      console.log(`Successfully marked Bill ${actualBillId} as paid.`);
    } else {
      console.log("No orderId found in metadata.");
    }
    return ok('done');
  }

  console.log("UNHANDLED EVENT TYPE:", type);
  return ok('ignored');
});