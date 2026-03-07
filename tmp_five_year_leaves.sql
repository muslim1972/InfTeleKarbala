-- السكربت الخاص بإنشاء جدول إجازات الخمس سنوات (five_year_leaves)
-- يرجى تنفيذه في محرر SQL داخل Supabase

CREATE TABLE public.five_year_leaves (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  order_number text,
  order_date date,
  start_date date NOT NULL, -- تاريخ الانفكاك
  end_date date NOT NULL,   -- المباشرة المتوقعة
  status text NOT NULL DEFAULT 'active', -- 'active' أو 'canceled'
  
  -- معلومات الإنشاء
  created_by uuid,
  created_by_name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  
  -- معلومات آخر تعديل
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  last_modified_by uuid,
  last_modified_by_name text,
  modification_reason text, -- 'data_entry_error' أو 'order_change'
  
  -- معلومات الإلغاء
  canceled_by uuid,
  canceled_by_name text,
  canceled_at timestamp with time zone,
  cancellation_reason text, -- 'data_entry_error' أو 'cancellation_order'
  
  CONSTRAINT five_year_leaves_pkey PRIMARY KEY (id),
  CONSTRAINT five_year_leaves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT five_year_leaves_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT five_year_leaves_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id),
  CONSTRAINT five_year_leaves_canceled_by_fkey FOREIGN KEY (canceled_by) REFERENCES auth.users(id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_five_year_leaves_user_id ON public.five_year_leaves USING btree (user_id) TABLESPACE pg_default;
