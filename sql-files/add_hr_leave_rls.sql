-- السماح لمدراء النظام ومسؤولي الموارد البشرية برؤية جميع طلبات الإجازة

-- حذف السياسة القديمة إذا كانت موجودة (لتفادي التكرار)
DROP POLICY IF EXISTS "HR and Admins can view all leave requests" ON public.leave_requests;

-- إنشاء سياسة للمشاهدة (SELECT)
CREATE POLICY "HR and Admins can view all leave requests"
ON public.leave_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR admin_role = 'hr_supervisor')
  )
);

-- حذف سياسة التحديث القديمة إذا كانت موجودة
DROP POLICY IF EXISTS "HR and Admins can update leave requests" ON public.leave_requests;

-- إنشاء سياسة للتحديث (UPDATE) - مفيدة إذا أراد مشرف الذاتية تغيير حالة الطلب أو معالجته لاحقاً
CREATE POLICY "HR and Admins can update leave requests"
ON public.leave_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR admin_role = 'hr_supervisor')
  )
);
