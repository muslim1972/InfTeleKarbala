// دالة المصادقة الآمنة - تعمل على الخادم
// Secure Authentication Edge Function
// متوافق مع جدول profiles

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

    // البيانات تأتي كمصفوفة من الدالة
    const userData = Array.isArray(data) ? data[0] : data;

    if (!userData || !userData.success) {
      return new Response(
        JSON.stringify({ error: 'بيانات الدخول غير صحيحة' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
