
// @ts-nocheck — ملف Deno Edge Function (لا يُفحص بمكتبة TypeScript الخاصة بالويب)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

/**
 * bulk-create-users (بلا استيرادات خارجية — الخادم معزول عن الإنترنت)
 * إنشاء حسابات مستخدمي محافظة جماعياً من ملف الرواتب (للمطور فقط).
 * Input: { users: [{ job_number?, full_name, username, password? }], governorate: string, password?: string }
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
    const isDeveloper = prof?.role === 'admin' && (prof?.admin_role === 'developer' || prof?.admin_role === 'it_supervisor')
    if (!isDeveloper) throw new Error(`Access denied. role=${prof?.role}, admin_role=${prof?.admin_role}`)

    // 3. البيانات المُرسلة — username وكلمة المرور لكل مستخدم من ملف Excel
    const { users, governorate, password } = await req.json()
    if (!Array.isArray(users) || users.length === 0) throw new Error('No users provided')
    if (!governorate) throw new Error('governorate is required')
    const defaultPassword = password || '123456'

    // 4. الموجودون مسبقاً في هذه المحافظة (بالرقم الوظيفي وباسم المستخدم)
    const existingSet = new Set<string>()
    const existingUsernames = new Set<string>()
    const jobNumbers = users.map((u: any) => String(u.job_number || '').trim()).filter(Boolean)
    const usernames = users.map((u: any) => String(u.username || '').trim()).filter(Boolean)
    const inQuery = (arr: string[]) => `in.(${arr.map(encodeURIComponent).join(',')})`
    for (let i = 0; i < jobNumbers.length; i += 200) {
      const chunk = jobNumbers.slice(i, i + 200)
      if (chunk.length === 0) continue
      const q = `${URL}/rest/v1/profiles?select=job_number&governorate=eq.${encodeURIComponent(governorate)}&job_number=${inQuery(chunk)}`
      const r = await fetch(q, { headers: restHeaders(SERVICE, SERVICE) })
      if (r.ok) { const arr = await r.json(); if (Array.isArray(arr)) arr.forEach((p: any) => existingSet.add(String(p.job_number))) }
    }
    for (let i = 0; i < usernames.length; i += 200) {
      const chunk = usernames.slice(i, i + 200)
      if (chunk.length === 0) continue
      const q = `${URL}/rest/v1/profiles?select=username&governorate=eq.${encodeURIComponent(governorate)}&username=${inQuery(chunk)}`
      const r = await fetch(q, { headers: restHeaders(SERVICE, SERVICE) })
      if (r.ok) { const arr = await r.json(); if (Array.isArray(arr)) arr.forEach((p: any) => existingUsernames.add(String(p.username))) }
    }

    // 5. hash لكل كلمة مرور فريدة مع تخزين مؤقت
    const hashCache = new Map<string, string>()
    const getHash = async (pwd: string): Promise<string> => {
      if (hashCache.has(pwd)) return hashCache.get(pwd)!
      const hashRes = await fetch(`${URL}/rest/v1/rpc/hash_password`, {
        method: 'POST',
        headers: restHeaders(SERVICE, SERVICE),
        body: JSON.stringify({ password: pwd })
      })
      if (!hashRes.ok) throw new Error(`hash_password failed: ${hashRes.status}`)
      const h = await hashRes.json()
      hashCache.set(pwd, h)
      return h
    }

    // 6. الإنشاء فردياً — البريد وكلمة المرور من عمودي الملف
    let created = 0
    let skipped = 0
    const failed: { job_number: string, error: string }[] = []

    for (const u of users as { job_number?: string, full_name: string, username: string, password?: string }[]) {
      const username = String(u.username || '').trim()
      const jobNumber = String(u.job_number || '').trim()
      if (!username) { failed.push({ job_number: jobNumber || '?', error: 'username مفقود' }); continue }
      if ((jobNumber && existingSet.has(jobNumber)) || existingUsernames.has(username)) { skipped++; continue }

      const userPassword = String(u.password || '').trim() || defaultPassword
      const email = `${username}@inftele.com`
      try {
        // إنشاء مستخدم Auth عبر Admin API — كلمة المرور الخاصة بكل مستخدم من الملف
        const authRes = await fetch(`${URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: restHeaders(SERVICE, SERVICE),
          body: JSON.stringify({
            email,
            password: userPassword,
            email_confirm: true,
            user_metadata: { full_name: u.full_name || username }
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
            full_name: u.full_name || username,
            job_number: jobNumber || username,
            username,
            role: 'user',
            governorate,
            password_hash: await getHash(userPassword),
            password: null
          }])
        })
        if (!insRes.ok) {
          const errBody = await insRes.json().catch(() => ({}))
          throw new Error(`profile: ${errBody?.message || insRes.status}`)
        }
        created++
      } catch (e) {
        failed.push({ job_number: jobNumber || username, error: (e as Error).message })
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
