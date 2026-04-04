-- إنشاء جدول لإدارة المكالمات الصوتية
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'calling', -- 'calling', 'active', 'ended', 'missed', 'busy'
    cloudflare_session_id TEXT, -- معرف الجلسة من كلاود فلير
    offer_sdp JSONB, -- لتبادل WebRTC Handshake
    answer_sdp JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول لتبادل الـ ICE Candidates (إشارات الشبكة)
CREATE TABLE IF NOT EXISTS public.call_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    candidate JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_candidates ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Users can view their own calls" ON public.calls
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert their own calls" ON public.calls
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own calls" ON public.calls
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can view/insert candidates" ON public.call_candidates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.calls c
            WHERE c.id = call_id
            AND (auth.uid() = c.sender_id OR auth.uid() = c.recipient_id)
        )
    );

-- تفعيل Realtime للجداول
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_candidates;
