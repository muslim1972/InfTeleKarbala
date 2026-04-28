// دالة المصادقة الآمنة - تعمل على الخادم
// Secure Authentication Edge Function
// متوافق مع جدول profiles مع دعم 2FA و Rate Limiting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // التعامل مع طلبات CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { job_number, password } = await req.json()
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

    if (!job_number || !password) {
      return new Response(
        JSON.stringify({ error: 'رقم الوظيفة وكلمة المرور مطلوبان' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // إنشاء عميل Supabase بصلاحيات الخادم
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Rate Limiting Check
    const { data: rlData, error: rlError } = await supabaseAdmin
      .from('rate_limits')
      .select('*')
      .eq('identifier', clientIp)
      .eq('endpoint', 'auth-login')
      .single();

    if (rlData && rlData.blocked_until && new Date(rlData.blocked_until) > new Date()) {
      return new Response(
        JSON.stringify({ error: 'تم حظر الحساب مؤقتاً لمحاولات كثيرة. حاول لاحقاً.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // استدعاء دالة المصادقة الآمنة
    const { data, error } = await supabaseAdmin.rpc('authenticate_user', {
      p_job_number: job_number,
      p_password: password
    })

    if (error) {
      console.error('Auth error:', error)
      return new Response(
        JSON.stringify({ error: 'خطأ في المصادقة' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userData = Array.isArray(data) ? data[0] : data;

    if (!userData || !userData.success) {
      // تحديث Rate Limiting
      if (rlData) {
        let updates: any = { attempts: rlData.attempts + 1, last_attempt: new Date() };
        if (updates.attempts >= 5) {
          updates.blocked_until = new Date(Date.now() + 5 * 60000); // 5 دقائق حظر
        }
        await supabaseAdmin.from('rate_limits').update(updates).eq('id', rlData.id);
      } else {
        await supabaseAdmin.from('rate_limits').insert({
          identifier: clientIp, endpoint: 'auth-login', attempts: 1
        });
      }

      return new Response(
        JSON.stringify({ error: 'بيانات الدخول غير صحيحة' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Reset Rate Limit on success
    if (rlData) {
      await supabaseAdmin.from('rate_limits').delete().eq('id', rlData.id);
    }

    // 2. التحقق من المصادقة الثنائية 2FA
    const { data: userDetails, error: userError } = await supabaseAdmin
      .from('app_users')
      .select('email, two_factor_enabled')
      .eq('id', userData.id)
      .single();

    if (userDetails && userDetails.two_factor_enabled) {
      if (!userDetails.email) {
        return new Response(
          JSON.stringify({ error: 'المصادقة الثنائية مفعلة لكن لا يوجد إيميل مرتبط' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // إنشاء كود سري من 6 أرقام
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires_at = new Date(Date.now() + 10 * 60000); // 10 دقائق

      // حفظ الكود
      await supabaseAdmin.from('app_users').update({
        two_factor_code: code,
        two_factor_expires_at: expires_at
      }).eq('id', userData.id);

      // هنا يمكن إرسال الكود عبر Resend أو أي خدمة أخرى
      // كمثال، نطبعها في اللوج، ويجب استبدالها بطلب HTTP للخدمة البريدية
      console.log(`Sending 2FA Code ${code} to ${userDetails.email}`);
      // await fetch('https://api.resend.com/emails', { ... })

      return new Response(
        JSON.stringify({
          requires_2fa: true,
          user_id: userData.id,
          message: 'تم إرسال كود التحقق إلى بريدك الإلكتروني'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // إذا لم تكن المصادقة الثنائية مفعلة، تسجيل الدخول مباشرة
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userData.id,
          full_name: userData.full_name,
          role: userData.role
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
