-- 1. التأكد من وجود الدالة السابقة أولاً كما طلبت
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_user_exists') THEN
        RAISE EXCEPTION 'الدالة check_user_exists غير موجودة في قاعدة البيانات!';
    END IF;
END $$;

-- 2. إنشاء جدول لتسجيل محاولات الفحص (Rate Limiting)
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    ip_address text PRIMARY KEY,
    attempts integer DEFAULT 1,
    last_attempt timestamptz DEFAULT now(),
    blocked_until timestamptz
);

-- 3. تفعيل RLS على جدول الحماية لكي لا يقرأه أحد
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- 4. تعديل الدالة لتشمل نظام الحظر
CREATE OR REPLACE FUNCTION check_user_exists(p_username text, p_governorate text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    client_ip text;
    user_record public.api_rate_limits%ROWTYPE;
BEGIN
    -- محاولة جلب الآيبي الخاص بالمستخدم
    client_ip := coalesce(
        current_setting('request.headers', true)::json->>'x-forwarded-for',
        current_setting('request.headers', true)::json->>'cf-connecting-ip',
        'unknown'
    );

    -- إذا تم التقاط الآيبي، نطبق الحظر
    IF client_ip != 'unknown' THEN
        SELECT * INTO user_record FROM public.api_rate_limits WHERE ip_address = client_ip;
        
        IF FOUND THEN
            -- إذا كان محظوراً ولم ينتهِ الوقت
            IF user_record.blocked_until > now() THEN
                RAISE EXCEPTION 'تم حظرك مؤقتاً بسبب كثرة المحاولات. حاول مجدداً بعد 15 دقيقة.';
            END IF;

            -- إذا مرت 15 دقيقة، نصفر العداد
            IF now() - user_record.last_attempt > interval '15 minutes' THEN
                UPDATE public.api_rate_limits SET attempts = 1, last_attempt = now(), blocked_until = NULL WHERE ip_address = client_ip;
            ELSE
                -- زيادة العداد
                IF user_record.attempts >= 10 THEN
                    -- حظر لمدة 15 دقيقة
                    UPDATE public.api_rate_limits SET blocked_until = now() + interval '15 minutes', last_attempt = now() WHERE ip_address = client_ip;
                    RAISE EXCEPTION 'تم حظرك مؤقتاً بسبب كثرة المحاولات. حاول مجدداً بعد 15 دقيقة.';
                ELSE
                    UPDATE public.api_rate_limits SET attempts = attempts + 1, last_attempt = now() WHERE ip_address = client_ip;
                END IF;
            END IF;
        ELSE
            -- أول محاولة لهذا الآيبي
            INSERT INTO public.api_rate_limits (ip_address, attempts) VALUES (client_ip, 1);
        END IF;
    END IF;

    -- بعد اجتياز الحماية، ننفذ الفحص الفعلي
    RETURN EXISTS (
        SELECT 1
        FROM profiles
        WHERE username = p_username
        AND governorate = p_governorate
    );
END;
$$;
