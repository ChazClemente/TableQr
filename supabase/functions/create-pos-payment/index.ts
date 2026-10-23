const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS for Angular
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, description, billId } = await req.json()
    const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')

    if (!PAYMONGO_SECRET_KEY) {
      throw new Error('PAYMONGO_SECRET_KEY is missing from Supabase secrets.')
    }

    // Call PayMongo to create a Payment Intent
    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(PAYMONGO_SECRET_KEY + ':'),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(amount * 100), // Convert to centavos (₱396 = 39600)
            currency: 'PHP',
            payment_method_allowed: ['gcash', 'paymaya', 'qrph'],
            description: description,
            metadata: {
              billId: String(billId) // Force string to fix PayMongo's nested attribute error
            }
          },
        },
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error("PayMongo API Error:", data);
      throw new Error(data.errors?.[0]?.detail || 'Failed to create payment intent');
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})