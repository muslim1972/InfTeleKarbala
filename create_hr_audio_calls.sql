-- create_hr_audio_calls.sql
-- جدول جديد خاص بالمكالمات الصوتية (Cloudflare SFU) 
-- لتطبيق InfTeleKarbala

CREATE TABLE public.hr_audio_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  
  -- الجلسة المشتركة للمكالمة في Cloudflare (كلا الطرفين يسحبان من نفس الـ session)
  cf_session_id TEXT,
  receiver_cf_session_id TEXT,
  
  -- حالة المكالمة: calling, active, ended, missed, rejected
  status TEXT NOT NULL DEFAULT 'calling',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- تفعيل Realtime على الجدول للاستماع للمكالمات الواردة
ALTER PUBLICATION supabase_realtime ADD TABLE hr_audio_calls;

-- سياسات الخصوصية (RLS)
ALTER TABLE public.hr_audio_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audio calls" ON public.hr_audio_calls
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert audio calls" ON public.hr_audio_calls
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their audio calls" ON public.hr_audio_calls
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
