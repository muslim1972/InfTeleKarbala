import { supabase } from './supabase';

export async function logSystemError(
  errorMessage: string,
  errorStack?: string | null,
  context?: Record<string, any>
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;

    await supabase.from('system_error_logs').insert({
      user_id: userId,
      error_message: errorMessage,
      error_stack: errorStack || null,
      context: context || null
    });
  } catch (err) {
    console.error('Failed to log system error:', err);
  }
}
