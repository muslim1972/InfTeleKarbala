-- Add duty-specific columns to leave_requests
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS duty_paper_number TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS duty_paper_date DATE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS duty_type TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS departure_time TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS duty_execution_date DATE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS duty_approved_by_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN leave_requests.duty_paper_number IS 'رقم ورقة الواجب - يُملأ من قِبل مشرف البصمة';
COMMENT ON COLUMN leave_requests.duty_paper_date IS 'تاريخ ورقة الواجب - يُملأ من قِبل مشرف البصمة';
COMMENT ON COLUMN leave_requests.duty_type IS 'نوع الواجب - نص حر يكتبه الموظف';
COMMENT ON COLUMN leave_requests.departure_time IS 'وقت المغادرة - يُحدده الموظف';
COMMENT ON COLUMN leave_requests.duty_execution_date IS 'تاريخ تنفيذ الواجب - اليوم أو غداً فقط';
COMMENT ON COLUMN leave_requests.duty_approved_by_name IS 'اسم المسؤول الذي وافق على الواجب';
