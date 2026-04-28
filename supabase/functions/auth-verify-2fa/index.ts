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

    const { code } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ error: 'الكود مطلوب' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Rate Limiting Check
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const { data: rlData } = await supabaseAdmin
      .from('rate_limits')
      .select('*')
      .eq('identifier', `verify-2fa-${user.id}-${clientIp}`)
      .eq('endpoint', 'verify-2fa')
      .single();

    if (rlData && rlData.blocked_until && new Date(rlData.blocked_until) > new Date()) {
      return new Response(JSON.stringify({ error: 'تم حظر المحاولات مؤقتاً. حاول لاحقاً.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('two_factor_code, two_factor_expires_at')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.two_factor_code) {
      return new Response(JSON.stringify({ error: 'لا يوجد كود نشط' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const isCodeValid = profile.two_factor_code === code;
    const isNotExpired = new Date(profile.two_factor_expires_at) > new Date();

    if (!isCodeValid || !isNotExpired) {
      if (rlData) {
        let updates: any = { attempts: rlData.attempts + 1, last_attempt: new Date() };
        if (updates.attempts >= 5) updates.blocked_until = new Date(Date.now() + 5 * 60000);
        await supabaseAdmin.from('rate_limits').update(updates).eq('id', rlData.id);
      } else {
        await supabaseAdmin.from('rate_limits').insert({ identifier: `verify-2fa-${user.id}-${clientIp}`, endpoint: 'verify-2fa', attempts: 1 });
      }
      return new Response(JSON.stringify({ error: !isNotExpired ? 'انتهت صلاحية الكود' : 'الكود غير صحيح' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Success: Clear code and reset rate limit
    if (rlData) await supabaseAdmin.from('rate_limits').delete().eq('id', rlData.id);
    await supabaseAdmin.from('profiles').update({ two_factor_code: null, two_factor_expires_at: null }).eq('id', user.id);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'خطأ في الخادم' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
