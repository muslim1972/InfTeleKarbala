
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Get current user and verify they are an admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      throw new Error('Only admins can sync auth users')
    }

    // 2. Get target user data
    const { user_id, email, password } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 3. Sync Auth User via Admin API
    let authError = null;
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users.find(u => u.id === user_id);

    if (existingUser) {
      // UPDATE
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email: email,
        password: password,
        email_confirmed_at: new Date().toISOString()
      });
      authError = error;
    } else {
      // CREATE
      const { error } = await supabaseAdmin.auth.admin.createUser({
        id: user_id,
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: email.split('@')[0] }
      });
      authError = error;
    }

    if (authError) throw authError

    // 4. Update Profile Password Hash
    const { data: hash } = await supabaseAdmin.rpc('hash_password', { password })
    
    // Check if profile exists to decide between update or just returning success
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user_id)
      .single()

    if (existingProfile) {
      await supabaseAdmin
        .from('profiles')
        .update({ 
          password_hash: hash,
          password: null 
        })
        .eq('id', user_id)
    }

    return new Response(
      JSON.stringify({ success: true, hash: hash }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
