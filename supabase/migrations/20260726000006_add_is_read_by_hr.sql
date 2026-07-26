-- Add is_read_by_hr column to track if HR has dismissed the notification
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS is_read_by_hr BOOLEAN DEFAULT false;

-- Add a comment for documentation
COMMENT ON COLUMN public.leave_requests.is_read_by_hr IS 'Indicates if the HR supervisor has dismissed the notification for this request';
