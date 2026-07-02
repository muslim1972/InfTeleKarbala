-- =============================================
-- جدول بيانات اعتماد WebAuthn للتحقق البيومتري
-- يخزن المفاتيح العامة المرتبطة ببصمة الموظف وجهازه
-- المفتاح السري يبقى في شريحة الأمان الفيزيائية للجهاز
-- =============================================

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    device_name TEXT DEFAULT 'جهاز غير معروف',
    finger_label TEXT DEFAULT 'إصبع غير مسمى',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_credential UNIQUE(credential_id),
    CONSTRAINT unique_user_credential UNIQUE(user_id, credential_id)
);

-- فهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_active ON public.webauthn_credentials(user_id, is_active);

-- تفعيل RLS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- الموظف يرى بصماته فقط
CREATE POLICY "Users can view own webauthn credentials"
    ON public.webauthn_credentials FOR SELECT
    USING (auth.uid() = user_id);

-- الموظف يمكنه إضافة بصمة لنفسه (بحد أقصى 2 بصمات فعالة)
CREATE POLICY "Users can insert own webauthn credentials"
    ON public.webauthn_credentials FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            SELECT COUNT(*) FROM public.webauthn_credentials
            WHERE user_id = auth.uid() AND is_active = true
        ) < 2
    );

-- الموظف يمكنه تعطيل بصماته (soft delete)
CREATE POLICY "Users can deactivate own webauthn credentials"
    ON public.webauthn_credentials FOR UPDATE
    USING (auth.uid() = user_id);

-- المشرف يدير كل البصمات
CREATE POLICY "Admins manage all webauthn credentials"
    ON public.webauthn_credentials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
