
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

/**
 * bulk-create-users (بلا استيرادات خارجية — الخادم معزول عن الإنترنت)
 * إنشاء حسابات مستخدمي محافظة جماعياً من ملف الرواتب (للمطور فقط).
 * Input: { users: [{ job_number, full_name }], governorate: string, password?: string }
 * Returns: { success, created, skipped, failed: [{ job_number, error }] }
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

    // 2. التحقق من صلاحية المطور
    const profRes = await fetch(`${URL}/rest/v1/available_profiles?select=role,admin_role&id=eq.${uid}`, {
      headers: restHeaders(ANON, userToken)
    })
    const profArr = await profRes.json()
    const prof = Array.isArray(profArr) ? profArr[0] : null
    const isDeveloper = prof?.role === 'admin' && prof?.admin_role === 'developer'
    if (!isDeveloper) throw new Error(`Access denied. role=${prof?.role}, admin_role=${prof?.admin_role}`)

    // 3. البيانات المُرسلة
    const { users, governorate, password } = await req.json()
    if (!Array.isArray(users) || users.length === 0) throw new Error('No users provided')
    if (!governorate) throw new Error('governorate is required')
    const defaultPassword = password || '123456'

    // 4. الموجودون مسبقاً في هذه المحافظة (لتخطيهم دفعة واحدة)
    const jobNumbers = users.map((u: any) => String(u.job_number || '').trim()).filter(Boolean)
    const existingSet = new Set<string>()
    for (let i = 0; i < jobNumbers.length; i += 200) {
      const chunk = jobNumbers.slice(i, i + 200)
      const q = `${URL}/rest/v1/profiles?select=job_number&governorate=eq.${encodeURIComponent(governorate)}&job_number=in.(${chunk.map(encodeURIComponent).join(',')})`
      const r = await fetch(q, { headers: restHeaders(SERVICE, SERVICE) })
      if (r.ok) {
        const arr = await r.json()
        if (Array.isArray(arr)) arr.forEach((p: any) => existingSet.add(String(p.job_number)))
      }
    }

    // 5. توليد hash كلمة المرور مرة واحدة (نفس RPC المستخدم نظامياً)
    const hashRes = await fetch(`${URL}/rest/v1/rpc/hash_password`, {
      method: 'POST',
      headers: restHeaders(SERVICE, SERVICE),
      body: JSON.stringify({ password: defaultPassword })
    })
    if (!hashRes.ok) throw new Error(`hash_password failed: ${hashRes.status}`)
    const passwordHash = await hashRes.json()

    // 6. الإنشاء فردياً (auth admin API + profile) مع تخطي الموجود
    let created = 0
    let skipped = 0
    const failed: { job_number: string, error: string }[] = []

    for (const u of users as { job_number: string, full_name: string }[]) {
      const jobNumber = String(u.job_number || '').trim()
      if (!jobNumber || existingSet.has(jobNumber)) { skipped++; continue }

      const email = `${jobNumber}@inftele.com`
      try {
        // إنشاء مستخدم Auth عبر Admin API
        const authRes = await fetch(`${URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: restHeaders(SERVICE, SERVICE),
          body: JSON.stringify({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: { full_name: u.full_name || jobNumber }
          })
        })
        if (!authRes.ok) {
          const errBody = await authRes.json().catch(() => ({}))
          throw new Error(`auth: ${errBody?.msg || errBody?.error_description || errBody?.message || authRes.status}`)
        }
        const createdUser = await authRes.json()
        const newId = createdUser?.id

        // إدراج البروفايل
        const insRes = await fetch(`${URL}/rest/v1/profiles`, {
          method: 'POST',
          headers: { ...restHeaders(SERVICE, SERVICE), 'Prefer': 'return=minimal' },
          body: JSON.stringify([{
            id: newId,
            full_name: u.full_name || jobNumber,
            job_number: jobNumber,
            username: jobNumber,
            role: 'user',
            governorate,
            password_hash: passwordHash,
            password: null
          }])
        })
        if (!insRes.ok) {
          const errBody = await insRes.json().catch(() => ({}))
          throw new Error(`profile: ${errBody?.message || insRes.status}`)
        }
        created++
      } catch (e) {
        failed.push({ job_number: jobNumber, error: (e as Error).message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, created, skipped, failed }),
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
