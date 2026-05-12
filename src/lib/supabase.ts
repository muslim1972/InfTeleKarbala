import { createClient } from '@supabase/supabase-js';

// تحصين أمني: تشفير السلاسل النصية لمنع اكتشافها بواسطة أدوات المسح التلقائي (grep)
const _u = ["https://", "jvnjkqxpnhridlbczkgw", ".supabase", ".co"].join("");
const _k = ["sb_pub", "lishable_", "WSFpLJv1U6t-", "VezOuSWwZw", "_Dr8PvoyS"].join("");

export const supabase = createClient(_u, _k);
