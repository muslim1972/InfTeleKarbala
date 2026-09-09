
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

/**
 * admin-sync-auth (بلا استيرادات خارجية — الخادم معزول عن الإنترنت)
 * مزامنة حساب Auth لمستخدم موجود (ترقية مشرف مثلاً) + تحديث password_hash في profiles.
 * Input: { user_id, email, password }
 * Returns: { success, hash, user_id }
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const URL = Deno.env.get('SUPABASE_URL') ?? ''
  const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const restHeaders = (key: string, auth: string) => ({
    'apikey': key,
    'Authorization': `Bearer ${auth}`,
    'Content-Type': 'application/json'
  })

  try {
    // 1. التحقق من هوية المستخدم عبر خادم Auth نفسه
    const userToken = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const meRes = await fetch(`${URL}/auth/v1/user`, {
      headers: restHeaders(ANON, userToken)
    })
    if (!meRes.ok) throw new Error('Unauthorized: invalid token')
    const me = await meRes.json()
    const uid = me?.id
    if (!uid) throw new Error('Unauthorized: no user')

    // 2. التحقق من الصلاحية (admin أو أدوار إدارية)
    const profRes = await fetch(`${URL}/rest/v1/available_profiles?select=role,admin_role&id=eq.${uid}`, {
      headers: restHeaders(ANON, userToken)
    })
    const profArr = await profRes.json()
    const prof = Array.isArray(profArr) ? profArr[0] : null
    const allowedRoles = ['admin']
    const allowedAdminRoles = ['developer', 'hr', 'general']
    if (!allowedRoles.includes(prof?.role) && !allowedAdminRoles.includes(prof?.admin_role)) {
      throw new Error(`Access denied. role=${prof?.role}, admin_role=${prof?.admin_role}`)
    }

    // 3. البيانات المُرسلة
    const { user_id, email, password } = await req.json()
    if (!user_id || !email || !password) throw new Error('user_id, email, password are required')

    let finalUserId = user_id

    // 4. مزامنة حساب Auth: تحديث إن وُجد وإلا إنشاء (بدل listUsers — نفس منطق getUserById)
    const getRes = await fetch(`${URL}/auth/v1/admin/users?id=eq.${encodeURIComponent(user_id)}`, {
      headers: restHeaders(SERVICE, SERVICE)
    })
    let existingUser: any = null
    if (getRes.ok) {
      const body = await getRes.json()
      const arr = Array.isArray(body) ? body : body?.users
      existingUser = Array.isArray(arr) && arr.length > 0 ? arr[0] : null
    }

    if (existingUser?.id) {
      // تحديث المستخدم الموجود
      finalUserId = existingUser.id
      const updRes = await fetch(`${URL}/auth/v1/admin/users/${finalUserId}`, {
        method: 'PUT',
        headers: restHeaders(SERVICE, SERVICE),
        body: JSON.stringify({ email, password, email_confirm: true })
      })
      if (!updRes.ok) {
        const errBody = await updRes.json().catch(() => ({}))
        throw new Error(`Auth sync error: ${errBody?.msg || errBody?.message || updRes.status}`)
      }
    } else {
      // إنشاء مستخدم جديد بنفس الـ id المطلوب
      const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: restHeaders(SERVICE, SERVICE),
        body: JSON.stringify({
          id: user_id,
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: String(email).split('@')[0] }
        })
      })
      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}))
        throw new Error(`Auth sync error: ${errBody?.msg || errBody?.message || createRes.status}`)
      }
      const createdUser = await createRes.json()
      finalUserId = createdUser?.id || user_id
    }

    // 5. توليد hash كلمة المرور (نفس RPC المستخدم نظامياً)
    const hashRes = await fetch(`${URL}/rest/v1/rpc/hash_password`, {
      method: 'POST',
      headers: restHeaders(SERVICE, SERVICE),
      body: JSON.stringify({ password })
    })
    if (!hashRes.ok) throw new Error(`Hash error: ${hashRes.status}`)
    const hash = await hashRes.json()

    // 6. تحديث البروفايل إن وُجد فقط
    const pRes = await fetch(`${URL}/rest/v1/profiles?select=id&id=eq.${encodeURIComponent(finalUserId)}`, {
      headers: restHeaders(SERVICE, SERVICE)
    })
    if (pRes.ok) {
      const pArr = await pRes.json()
      if (Array.isArray(pArr) && pArr.length > 0) {
        await fetch(`${URL}/rest/v1/profiles?id=eq.${encodeURIComponent(finalUserId)}`, {
          method: 'PATCH',
          headers: restHeaders(SERVICE, SERVICE),
          body: JSON.stringify({ password_hash: hash, password: null })
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, hash, user_id: finalUserId }),
      { headers: corsHeaders, status: 200 }
    )
  } catch (error) {
    const err = error as Error
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: corsHeaders, status: 400 }
    )
  }
})
