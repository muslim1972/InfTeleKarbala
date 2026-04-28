import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify user token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Rate Limiting Check
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const { data: rlData } = await supabaseAdmin
      .from('rate_limits')
      .select('*')
      .eq('identifier', `send-2fa-${user.id}-${clientIp}`)
      .eq('endpoint', 'send-2fa-email')
      .single();

    if (rlData && rlData.blocked_until && new Date(rlData.blocked_until) > new Date()) {
      return new Response(
        JSON.stringify({ error: 'يرجى الانتظار قبل طلب كود جديد' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, two_factor_enabled')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.email) {
      return new Response(JSON.stringify({ error: 'البريد الإلكتروني غير مسجل في الحساب' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Generate Code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 5 * 60000); // 5 minutes

    // Save Code
    await supabaseAdmin.from('profiles').update({
      two_factor_code: code,
      two_factor_expires_at: expires_at
    }).eq('id', user.id);

    // Update Rate Limit
    if (rlData) {
      await supabaseAdmin.from('rate_limits').update({ 
        attempts: rlData.attempts + 1, 
        last_attempt: new Date(),
        blocked_until: new Date(Date.now() + 60000) // Block for 1 minute to prevent spam
      }).eq('id', rlData.id);
    } else {
      await supabaseAdmin.from('rate_limits').insert({
        identifier: `send-2fa-${user.id}-${clientIp}`, endpoint: 'send-2fa-email', attempts: 1,
        blocked_until: new Date(Date.now() + 60000)
      });
    }

    // Send Email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || Deno.env.get('Resend_API_Key');
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'security@inftelekarbala.com',
          to: profile.email,
          subject: 'رمز التحقق الثنائي (2FA)',
          html: `<p>رمز التحقق الخاص بك هو: <strong>${code}</strong></p><p>صالح لمدة 5 دقائق.</p>`
        })
      });
    } else {
      console.log(`[SIMULATED EMAIL] To: ${profile.email}, Code: ${code}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'تم إرسال الكود' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'خطأ في الخادم' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
