// NotificationsBell – مكون الجرس لعرض دعوات الاجتماعات الواردة
// مستوحى من نظام إشعارات InfTeleKarbala (EmployeeNotifications)
import { useState, useEffect, useCallback } from 'react';
import { Bell, X, CheckCircle, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface MeetingNotification {
  id: string;
  meeting_id: string;
  meeting_title?: string;
  invited_by_name?: string;
  created_at: string;
  is_read: boolean;
}

interface NotificationsBellProps {
  userId: string;
}

export default function NotificationsBell({ userId }: NotificationsBellProps) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState<MeetingNotification[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId || userId === 'visitor-id') return;

    setLoading(true);
    try {
      // جلب كل الدعوات غير المقروءة للمستخدم الحالي
      const { data, count, error } = await supabase
        .from('meeting_participants')
        .select(`
          id,
          meeting_id,
          created_at,
          is_read,
          meetings!inner (
            id,
            title,
            created_by,
            profiles:created_by (
              full_name
            )
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('NotificationsBell: Error fetching:', error);
        return;
      }

      if (data) {
        const formatted: MeetingNotification[] = data.map((item: any) => ({
          id: item.id,
          meeting_id: item.meeting_id,
          meeting_title: item.meetings?.title || 'اجتماع',
          invited_by_name: item.meetings?.profiles?.full_name || 'مستخدم',
          created_at: item.created_at,
          is_read: item.is_read,
        }));
        setUnreadNotifications(formatted);
        setUnreadCount(count || 0);
      } else {
        setUnreadNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('NotificationsBell: Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    // الاشتراك في تحديثات Supabase Realtime
    const channel = supabase
      .channel('meeting_participants_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meeting_participants',
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [userId, fetchNotifications]);

  // تعليم إشعار واحد كمقروء
  const handleDismiss = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      const updated = unreadNotifications.filter(n => n.id !== notificationId);
      setUnreadNotifications(updated);
      setUnreadCount(updated.length);

      if (updated.length === 0) {
        setShowModal(false);
      }
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  // تعليم الكل كمقروء
  const handleDismissAll = async () => {
    try {
      const ids = unreadNotifications.map(n => n.id);
      const { error } = await supabase
        .from('meeting_participants')
        .update({ is_read: true })
        .in('id', ids);

      if (error) throw error;

      setUnreadNotifications([]);
      setUnreadCount(0);
      setShowModal(false);
    } catch (err) {
      console.error('Error dismissing all:', err);
    }
  };

  // الانتقال إلى الاجتماع
  const handleJoinMeeting = (meetingId: string) => {
    navigate(`/meeting/${meetingId}`);
    setShowModal(false);
  };

  if (unreadCount === 0 && !loading) return null;

  return (
    <>
      {/* زر الجرس العائم */}
      <AnimatePresence>
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={() => {
            if (unreadNotifications.length > 0) {
              setShowModal(true);
            }
          }}
          className="fixed bottom-6 left-6 z-[100] bg-slate-800 p-3 rounded-full shadow-2xl border-2 border-blue-500 hover:bg-slate-700 transition-colors group"
          title="إشعارات الاجتماعات"
        >
          <div className="relative">
            <Bell className="text-white" size={22} />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {/* حلقة نبضية */}
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 animate-ping pointer-events-none" />
        </motion.button>
      </AnimatePresence>

      {/* مودال الإشعارات */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-arabic" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-slate-700"
            >
              {/* Header */}
              <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Bell size={20} />
                  دعوات الاجتماعات ({unreadCount})
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="hover:bg-white/20 p-1 rounded-xl transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* List */}
              <div className="overflow-y-auto p-4 flex-1 space-y-3 custom-scrollbar">
                {unreadNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="border border-slate-700 rounded-xl p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded inline-block mb-2 text-blue-400 bg-blue-900/30 border border-blue-500/30">
                        🎥 دعوة اجتماع فيديو
                      </span>
                      <p className="text-sm text-slate-200 font-medium leading-relaxed">
                        <span className="text-white font-bold">{notif.invited_by_name}</span>
                        {' '}يدعوك للانضمام إلى اجتماع
                        {' '}
                        <span className="text-blue-400 font-bold">{notif.meeting_title}</span>
                      </p>
                    </div>

                    <div className="text-xs text-slate-500 mb-4 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                      تاريخ الدعوة: {new Date(notif.created_at).toLocaleString('ar-IQ')}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleJoinMeeting(notif.meeting_id)}
                        className="flex-1 text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
                      >
                        <Video size={16} />
                        انضم الآن
                      </button>
                      <button
                        onClick={() => handleDismiss(notif.id)}
                        className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-slate-300 transition flex items-center gap-1"
                        title="تجاهل"
                      >
                        <CheckCircle size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {unreadNotifications.length === 0 && (
                  <div className="text-center py-10 text-slate-500">
                    لا توجد إشعارات جديدة
                  </div>
                )}
              </div>

              {/* Footer */}
              {unreadNotifications.length > 1 && (
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 text-center">
                  <button
                    onClick={handleDismissAll}
                    className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-bold flex items-center justify-center gap-1 mx-auto transition-colors"
                  >
                    <CheckCircle size={14} />
                    تحديد الكل كمقروء
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}