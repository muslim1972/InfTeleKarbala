
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

    // 1. Get current user and verify they are authorized
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error(`Unauthorized: ${userError?.message || 'No user'}`)

    const { data: profile, error: profileError } = await supabaseClient
      .from('available_profiles')
      .select('role, admin_role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw new Error(`Profile fetch error: ${profileError.message} (code: ${profileError.code})`)
    }

    const allowedRoles = ['admin'];
    const allowedAdminRoles = ['developer', 'hr', 'general'];
    
    if (!allowedRoles.includes(profile?.role) && !allowedAdminRoles.includes(profile?.admin_role)) {
      throw new Error(`Access denied. role=${profile?.role}, admin_role=${profile?.admin_role}`)
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
    let finalUserId = user_id;
    
    // Instead of listUsers (which crashes if any row is corrupted), use getUserById
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    if (userData && userData.user) {
      // UPDATE existing user
      finalUserId = userData.user.id;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(finalUserId, {
        email: email,
        password: password,
        email_confirm: true
      });
      authError = error;
    } else {
      // CREATE new user
      const { error } = await supabaseAdmin.auth.admin.createUser({
        id: user_id,
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: email.split('@')[0] }
      });
      authError = error;
    }

    if (authError) throw new Error(`Auth sync error: ${authError.message}`)

    // 4. Update Profile Password Hash
    const { data: hash, error: hashError } = await supabaseAdmin.rpc('hash_password', { password })
    if (hashError) throw new Error(`Hash error: ${hashError.message}`)
    
    // Check if profile exists to decide between update or just returning success
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', finalUserId)
      .single()

    if (existingProfile) {
      await supabaseAdmin
        .from('profiles')
        .update({ 
          password_hash: hash,
          password: null 
        })
        .eq('id', finalUserId)
    }

    return new Response(
      JSON.stringify({ success: true, hash: hash, user_id: finalUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    const err = error as Error;
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
