import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';
import type {
  FingerprintTemplate,
  AttendanceRecord,
  AttendanceDevice,
  AttendanceException,
  AttendanceStats
} from '../types';

async function notifyAdminsForDeviceChange(employeeName: string) {
  try {
    await supabase.rpc('notify_admins_new_device', { p_employee_name: employeeName });

    const supervisorIdsSet = new Set<string>();
    try {
      const { data: rpcProfiles } = await supabase.rpc('get_available_profiles');
      if (rpcProfiles && Array.isArray(rpcProfiles)) {
        rpcProfiles.forEach((p: any) => {
          if (
            p.admin_role === 'general' ||
            p.admin_role === 'developer' ||
            p.role === 'admin'
          ) {
            if (p.id) supervisorIdsSet.add(p.id);
          }
        });
      }
    } catch (e) {
      console.error('Error fetching via get_available_profiles:', e);
    }

    const supervisorIds = Array.from(supervisorIdsSet);

    if (supervisorIds.length > 0) {
      const title = 'تسجيل جهاز جديد';
      const content = `قام الموظف (${employeeName}) بتسجيل جهازه لأول مرة بنجاح.`;
      const pushPromises = supervisorIds.map(supId =>
        sendPushNotification(supId, content, { title })
      );
      await Promise.allSettled(pushPromises);
    }
  } catch (err) {
    console.error('Error notifying admins for new device:', err);
  }
}

async function notifySupervisorsOfDeviceMismatch(
  employeeId: string,
  oldDeviceId: string,
  newDeviceId: string | undefined
) {
  console.log('[DeviceMismatch] ▶ START notifySupervisorsOfDeviceMismatch', { employeeId, oldDeviceId, newDeviceId });
  try {
    // 1. Safe insert into device_change_requests via SECURITY DEFINER RPC
    try {
      const { error: dcrError } = await supabase.rpc('submit_device_change_request', {
        p_employee_id: employeeId,
        p_old_device_id: oldDeviceId || 'unknown',
        p_new_device_id: newDeviceId || 'unknown'
      });
      if (dcrError) {
        console.warn('[DeviceMismatch] submit_device_change_request RPC error:', dcrError);
      } else {
        console.log('[DeviceMismatch] ✅ submit_device_change_request succeeded');
      }
    } catch (dcrErr) {
      console.warn('[DeviceMismatch] submit_device_change_request threw:', dcrErr);
    }

    // 2. Insert system notifications via dedicated RPC (SECURITY DEFINER, bypasses RLS)
    console.log('[DeviceMismatch] Calling notify_device_mismatch RPC...');
    const { data: notifyResult, error: notifyError } = await supabase.rpc('notify_device_mismatch', {
      p_employee_id: employeeId
    });

    if (notifyError) {
      console.error('[DeviceMismatch] ❌ notify_device_mismatch RPC FAILED:', notifyError);
    } else {
      console.log('[DeviceMismatch] ✅ notify_device_mismatch succeeded, notifications inserted count:', notifyResult);
    }

    // 3. Optional Push Notifications via OneSignal Edge Function
    try {
      let employeeName = 'موظف';
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', employeeId)
        .maybeSingle();

      if (userProfile?.full_name) {
        employeeName = userProfile.full_name;
      }

      const { data: directProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or('admin_role.eq.general,admin_role.eq.developer,role.eq.admin')
        .neq('id', employeeId);

      const supervisorIds: string[] = (directProfiles || []).map(p => p.id);

      if (supervisorIds.length > 0) {
        const title = 'تنبيه: تسجيل من جهاز غير معتمد';
        const content = `قام الموظف (${employeeName}) بتسجيل البصمة من جهاز غير معتمد، يرجى المراجعة.`;

        const pushPromises = supervisorIds.map(supId =>
          sendPushNotification(supId, content, {
            title,
            url: `${window.location.origin}/admin`
          })
        );
        await Promise.allSettled(pushPromises);
      }
    } catch (pushErr) {
      console.warn('[DeviceMismatch] Push notification error (non-critical):', pushErr);
    }

    console.log('[DeviceMismatch] ▶ END notifySupervisorsOfDeviceMismatch');
  } catch (err) {
    console.error('[DeviceMismatch] ❌ FATAL error:', err);
  }
}

// =============================================
// Fingerprint Template Services
// =============================================

export const fingerprintTemplateService = {
  async create(template: Omit<FingerprintTemplate, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .insert(template)
      .select()
      .single();
    if (error) throw error;
    return data as FingerprintTemplate;
  },

  async getByEmployeeId(employeeId: string) {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('template_version', { ascending: false });
    if (error) throw error;
    return data as FingerprintTemplate[];
  },

  async deactivate(id: string) {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as FingerprintTemplate;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('fingerprint_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// =============================================
// Attendance Record Services
// =============================================

export const attendanceRecordService = {
  async create(record: Partial<AttendanceRecord>) {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  },

  async update(id: string, updates: Partial<AttendanceRecord>) {
    const { data, error } = await supabase
      .from('attendance_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  },

  async getByEmployeeId(employeeId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as AttendanceRecord[];
  },

  async timeLeaveOut(employeeId: string, _location?: string, _deviceId?: string, _verifiedByBiometric: boolean = false) {
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) throw new Error('لم يتم تسجيل الحضور اليوم');

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        time_leave_out: now,
      })
      .eq('id', todayRecord.id)
      .select()
      .single();

    if (error) throw error;
    return data as AttendanceRecord;
  },

  async timeLeaveReturn(employeeId: string, _location?: string, _deviceId?: string, _verifiedByBiometric: boolean = false) {
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) throw new Error('لم يتم تسجيل الحضور اليوم');
    if (!todayRecord.time_leave_out) throw new Error('لم يتم تسجيل خروج زمني مسبقاً');

    const now = new Date();
    const timeLeaveOutTime = new Date(todayRecord.time_leave_out);
    const actualMinutesSpent = Math.max(0, Math.floor((now.getTime() - timeLeaveOutTime.getTime()) / 60000));

    // Record the return punch
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        time_leave_return: now.toISOString(),
      })
      .eq('id', todayRecord.id)
      .select()
      .single();

    if (error) throw error;

    // ----- Penalty Logic -----
    try {
      const todayStr = now.toISOString().split('T')[0];
      // Get today's approved time_off request
      const { data: leaveReqs } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', employeeId)
        .eq('leave_type', 'time_off')
        .eq('start_date', todayStr)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (leaveReqs && leaveReqs.length > 0) {
        const leaveReq = leaveReqs[0];
        const requestedMinutes = leaveReq.time_duration_minutes || 0;
        const delay = actualMinutesSpent - requestedMinutes;

        if (delay > 0) {
          let penalty = 0;
          let isForcedLeave = false;

          if (delay <= 5) penalty = 15;
          else if (delay <= 10) penalty = 30;
          else if (delay <= 15) penalty = 60;
          else isForcedLeave = true;

          const newDuration = requestedMinutes + penalty;
          if (newDuration > 120) isForcedLeave = true;

          if (isForcedLeave) {
            // Convert to a full day regular leave
            await supabase.from('leave_requests').update({
              leave_type: 'regular',
              time_duration_minutes: null,
              days_count: 1,
              reason: `${leaveReq.reason || ''} [تم تحويله لإجازة يوم كامل بسبب تجاوز الحد الزمني]`
            }).eq('id', leaveReq.id);

            // Notify user
            await supabase.from('system_notifications').insert({
              recipient_id: employeeId,
              type: 'system',
              title: 'تجاوز الإجازة الزمنية',
              content: `تم تحويل إجازتك الزمنية إلى إجازة يوم كامل بسبب تأخرك لفترة طويلة.`
            });

            // Notify supervisor
            if (leaveReq.supervisor_id) {
              const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', employeeId).single();
              await supabase.from('system_notifications').insert({
                recipient_id: leaveReq.supervisor_id,
                type: 'system',
                title: 'تحويل إجازة زمنية إجبارياً',
                content: `تم تحويل الإجازة الزمنية للموظف ${profile?.full_name || ''} إلى إجازة يوم كامل لتجاوزه الحد الزمني.`
              });
            }
          } else {
            // Update time_duration_minutes
            await supabase.from('leave_requests').update({
              time_duration_minutes: newDuration
            }).eq('id', leaveReq.id);

            // Notify user
            await supabase.from('system_notifications').insert({
              recipient_id: employeeId,
              type: 'system',
              title: 'خصم تأخير من الرصيد الزمني',
              content: `بسبب تأخرك لمدة ${delay} دقيقة عن الإجازة الزمنية، تم خصم ${penalty} دقيقة إضافية من رصيدك (المدة الجديدة: ${newDuration} دقيقة).`
            });
          }
        }
      }
    } catch (penaltyError) {
      console.error('Error applying time leave return penalty:', penaltyError);
    }

    return data as AttendanceRecord;
  },

  async getByDate(date: string) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AttendanceRecord[];
  },

  async getTodayByEmployeeId(employeeId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data[0] as AttendanceRecord | undefined;
  },

  async registerPunch(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false, snapshotUrl?: string, notes?: string) {
    const { categorizePunches } = await import('../utils/punchCategorizer');
    
    // 1. Get today's record
    const today = new Date().toISOString().split('T')[0];
    let record = await this.getTodayByEmployeeId(employeeId);
    
    const newPunch = {
      time: new Date().toISOString(),
      location,
      device_id: deviceId,
      snapshot_url: snapshotUrl,
      notes,
      verified_by_biometric: verifiedByBiometric
    };

    // 2. Load yesterday's record for night-shift logic
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const { data: yesterdayData } = await supabase
      .from('attendance_records')
      .select('check_in, check_out')
      .eq('employee_id', employeeId)
      .gte('created_at', `${yesterday}T00:00:00`)
      .lte('created_at', `${yesterday}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1);
      
    const yesterdayRecord = yesterdayData?.[0] as AttendanceRecord | undefined;

    // 3. Update raw_punches
    let rawPunches = [];
    if (record && record.raw_punches) {
      rawPunches = Array.isArray(record.raw_punches) ? record.raw_punches : [];
    }
    rawPunches.push(newPunch);

    // 4. Run categorizer
    const updates = categorizePunches(rawPunches, yesterdayRecord, today);
    updates.raw_punches = rawPunches;

    // Device logic
    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, primary_device_id, work_schedule_id, full_name')
      .eq('id', employeeId)
      .single();

    let isDevicePending = record?.is_device_pending || false;

    function extractHash(deviceStr: string | null | undefined): string {
      if (!deviceStr) return '';
      const match = deviceStr.match(/\[([a-f0-9]{32,64})\]/i);
      if (match) return match[1];
      return deviceStr.trim();
    }

    function isSameDevice(stored: string | null | undefined, current: string | null | undefined): boolean {
      if (!stored || !current) return false;
      if (stored === current) return true;
      const hash1 = extractHash(stored);
      const hash2 = extractHash(current);
      return hash1 !== '' && hash1 === hash2;
    }

    if (!profile?.primary_device_id && deviceId) {
      await supabase.from('profiles').update({ primary_device_id: deviceId }).eq('id', employeeId);
      await notifyAdminsForDeviceChange(profile?.full_name || 'موظف');
    } else if (profile?.primary_device_id && !isSameDevice(profile.primary_device_id, deviceId)) {
      isDevicePending = true;
      await notifySupervisorsOfDeviceMismatch(employeeId, profile.primary_device_id, deviceId);
      
      const punchTypeLabel = record?.check_in ? 'خروج' : 'دخول';
      const mismatchNote = `(${punchTypeLabel}: جهاز غير معتمد)`;
      if (updates.notes) {
        if (!updates.notes.includes(mismatchNote)) {
          updates.notes = updates.notes + ' - ' + mismatchNote;
        }
      } else if (notes) {
        updates.notes = notes + ' - ' + mismatchNote;
      } else {
        updates.notes = mismatchNote;
      }
    }
    updates.is_device_pending = isDevicePending;

    if (record) {
      // Update existing record
      const { data, error } = await supabase.from('attendance_records').update(updates).eq('id', record.id).select().single();
      if (error) throw error;
      
      const savedRecord = data as AttendanceRecord;
      try {
        await this.enforceMandatoryPenalties(employeeId, today, savedRecord);
      } catch (e) {
        console.error('Error applying mandatory penalties:', e);
      }
      return savedRecord;
    } else {
      // Create new record
      updates.employee_id = employeeId;
      updates.department_id = profile?.department_id;
      updates.work_schedule_id = profile?.work_schedule_id;
      updates.status = 'present'; // Default
      
      const { data, error } = await supabase.from('attendance_records').insert(updates).select().single();
      if (error) throw error;
      
      const savedRecord = data as AttendanceRecord;
      try {
        await this.enforceMandatoryPenalties(employeeId, today, savedRecord);
      } catch (e) {
        console.error('Error applying mandatory penalties:', e);
      }
      return savedRecord;
    }
  },

  async enforceMandatoryPenalties(employeeId: string, dateStr: string, record: AttendanceRecord) {
    const { data: profile } = await supabase.from('profiles').select('work_schedule_id').eq('id', employeeId).single();
    let scheduleQuery = supabase.from('work_schedules').select('*');
    if (profile?.work_schedule_id) scheduleQuery = scheduleQuery.eq('id', profile.work_schedule_id);
    else scheduleQuery = scheduleQuery.eq('is_default', true);
    
    const { data: schedule } = await scheduleQuery.limit(1).single();
    if (!schedule || !schedule.start_time || !schedule.end_time) return;

    const today = new Date(record.created_at || new Date().toISOString());
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today);
    if (schedule.weekend_days?.includes(dayName)) return;

    // Fetch all approved time_offs for today
    const { data: allTimeOffs } = await supabase
      .from('leave_requests')
      .select('id, time_off_subtype, time_duration_minutes, with_request, is_mandatory, leave_type')
      .eq('user_id', employeeId)
      .eq('start_date', dateStr)
      .eq('status', 'approved');

    // Find requested (not mandatory) shift_start and shift_end
    const requestedShiftStart = allTimeOffs?.find(r => r.time_off_subtype === 'shift_start' && r.with_request && r.leave_type === 'time_off');
    const requestedShiftEnd = allTimeOffs?.find(r => r.time_off_subtype === 'shift_end' && r.with_request && r.leave_type === 'time_off');

    const gracePeriod = schedule.grace_period_minutes || 0;
    const morningGracePeriod = requestedShiftStart ? 0 : gracePeriod;
    const eveningGracePeriod = requestedShiftEnd ? 0 : gracePeriod;
    
    // Auto-generated penalty leaves have with_request = false and the respective time_off_subtype
    // (If converted to a full day, they might be 'regular' type but we still identify them by not having with_request and matching the subtype/reason in case it was converted)
    const lateLeave = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && (l.time_off_subtype === 'shift_start' || (l.leave_type === 'regular' && l.reason?.includes('تأخير صباحي'))));
    const earlyLeave = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && (l.time_off_subtype === 'shift_end' || (l.leave_type === 'regular' && l.reason?.includes('خروج مبكر'))));

    // Helper to calculate total time off currently accumulated
    const calculateTotalTimeOff = (excludeId?: string) => {
        return allTimeOffs?.filter(r => r.leave_type === 'time_off' && r.id !== excludeId)
            .reduce((sum, req) => sum + (req.time_duration_minutes || 0), 0) || 0;
    };

    // Late Check-in
    if (record.check_in) {
      const checkInDate = new Date(record.check_in);
      const [sh, sm] = schedule.start_time.split(':').map(Number);
      const expectedStart = new Date(today);
      expectedStart.setHours(sh, sm, 0, 0);

      // Offset by requested shift_start time off
      if (requestedShiftStart && requestedShiftStart.time_duration_minutes) {
          expectedStart.setMinutes(expectedStart.getMinutes() + requestedShiftStart.time_duration_minutes);
      }

      const delayMins = Math.floor((checkInDate.getTime() - expectedStart.getTime()) / 60000) - morningGracePeriod;
      
      if (delayMins > 0) {
        let penaltyMins = 0;
        let isFullDay = false;
        
        if (delayMins <= 5) penaltyMins = 30;
        else if (delayMins <= 10) penaltyMins = 60;
        else if (delayMins <= 15) penaltyMins = 120;
        else isFullDay = true;

        const currentTotal = calculateTotalTimeOff(lateLeave?.id);
        if (!isFullDay && (currentTotal + penaltyMins > 120)) {
            isFullDay = true;
        }

        if (isFullDay) {
           if (!lateLeave || lateLeave.leave_type !== 'regular') {
              if (lateLeave) await supabase.from('leave_requests').delete().eq('id', lateLeave.id);
              
              // Cancel all other time_offs for today if converting to full day
              await supabase.from('leave_requests')
                  .update({ status: 'rejected', reason: 'ألغيت بسبب تحويل اليوم لإجازة اعتيادية لتأخير صباحي' })
                  .eq('user_id', employeeId)
                  .eq('start_date', dateStr)
                  .eq('leave_type', 'time_off');

              await supabase.from('leave_requests').insert({
                user_id: employeeId,
                leave_type: 'regular',
                start_date: dateStr,
                end_date: dateStr,
                days_count: 1,
                reason: `تأخير صباحي (${delayMins} دقيقة) - إجازة إجبارية`,
                status: 'approved',
                is_mandatory: true,
                with_request: false
              });
           }
        } else {
           if (!lateLeave) {
              await supabase.from('leave_requests').insert({
                user_id: employeeId,
                leave_type: 'time_off',
                start_date: dateStr,
                end_date: dateStr,
                time_duration_minutes: penaltyMins,
                reason: `تأخير صباحي (${delayMins} دقيقة) - إجازة زمنية إجبارية`,
                status: 'approved',
                is_mandatory: true,
                time_off_subtype: 'shift_start',
                with_request: false
              });
           } else if (lateLeave.leave_type === 'time_off' && lateLeave.time_duration_minutes !== penaltyMins) {
              await supabase.from('leave_requests').update({
                  time_duration_minutes: penaltyMins,
                  reason: `تأخير صباحي (${delayMins} دقيقة) - إجازة زمنية إجبارية`,
                  time_off_subtype: 'shift_start',
                  with_request: false
              }).eq('id', lateLeave.id);
           }
        }
      } else {
         if (lateLeave) await supabase.from('leave_requests').delete().eq('id', lateLeave.id);
      }
    }

    // Early Check-out
    if (record.check_out) {
      const checkOutDate = new Date(record.check_out);
      const [eh, em] = schedule.end_time.split(':').map(Number);
      const expectedEnd = new Date(today);
      expectedEnd.setHours(eh, em, 0, 0);

      // Offset by requested shift_end time off
      if (requestedShiftEnd && requestedShiftEnd.time_duration_minutes) {
          expectedEnd.setMinutes(expectedEnd.getMinutes() - requestedShiftEnd.time_duration_minutes);
      }

      const earlyMins = Math.floor((expectedEnd.getTime() - checkOutDate.getTime()) / 60000) - eveningGracePeriod;
      
      if (earlyMins > 0) {
        let penaltyMins = 0;
        let isFullDay = false;
        
        if (earlyMins <= 5) penaltyMins = 30;
        else if (earlyMins <= 10) penaltyMins = 60;
        else if (earlyMins <= 15) penaltyMins = 120;
        else isFullDay = true;

        const currentTotal = calculateTotalTimeOff(earlyLeave?.id);
        if (!isFullDay && (currentTotal + penaltyMins > 120)) {
            isFullDay = true;
        }

        if (isFullDay) {
            if (!earlyLeave || earlyLeave.leave_type !== 'regular') {
                if (earlyLeave) await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);
                
                await supabase.from('leave_requests')
                    .update({ status: 'rejected', reason: 'ألغيت بسبب تحويل اليوم لإجازة اعتيادية لخروج مبكر' })
                    .eq('user_id', employeeId)
                    .eq('start_date', dateStr)
                    .eq('leave_type', 'time_off');

                await supabase.from('leave_requests').insert({
                    user_id: employeeId,
                    leave_type: 'regular',
                    start_date: dateStr,
                    end_date: dateStr,
                    days_count: 1,
                    reason: `خروج مبكر (${earlyMins} دقيقة) - إجازة إجبارية`,
                    status: 'approved',
                    is_mandatory: true,
                    with_request: false
                });
            }
        } else {
            if (!earlyLeave) {
                await supabase.from('leave_requests').insert({
                    user_id: employeeId,
                    leave_type: 'time_off',
                    start_date: dateStr,
                    end_date: dateStr,
                    time_duration_minutes: penaltyMins,
                    reason: `خروج مبكر (${earlyMins} دقيقة) - إجازة زمنية إجبارية`,
                    status: 'approved',
                    is_mandatory: true,
                    time_off_subtype: 'shift_end',
                    with_request: false
                });
            } else if (earlyLeave.leave_type === 'time_off' && earlyLeave.time_duration_minutes !== penaltyMins) {
                await supabase.from('leave_requests').update({
                    time_duration_minutes: penaltyMins,
                    reason: `خروج مبكر (${earlyMins} دقيقة) - إجازة زمنية إجبارية`,
                    time_off_subtype: 'shift_end',
                    with_request: false
                }).eq('id', earlyLeave.id);
            }
        }
      } else {
         if (earlyLeave) await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);
      }
    } else {
        if (earlyLeave) await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);
    }
  },

  async checkIn(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false, snapshotUrl?: string, notes?: string) {
    const now = new Date().toISOString();
    
    // Get department, device info, and work schedule from employee profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, primary_device_id, work_schedule_id')
      .eq('id', employeeId)
      .single();

    let isDevicePending = false;

    // 1. If primary_device_id is null, set it to the current deviceId
    if (!profile?.primary_device_id && deviceId) {
      await supabase
        .from('profiles')
        .update({ primary_device_id: deviceId })
        .eq('id', employeeId);
      const { data: userProfile } = await supabase.from('profiles').select('full_name').eq('id', employeeId).single();
      await notifyAdminsForDeviceChange(userProfile?.full_name || 'موظف');
    } 
    else if (profile?.primary_device_id && profile.primary_device_id !== deviceId) {
      isDevicePending = true;
      await notifySupervisorsOfDeviceMismatch(employeeId, profile.primary_device_id, deviceId);
    }

    // --- Calculate Lateness Based on Work Schedule ---
    let initialStatus = 'present';
    
    // Fetch schedule if assigned, otherwise use default
    let scheduleQuery = supabase.from('work_schedules').select('*');
    if (profile?.work_schedule_id) {
      scheduleQuery = scheduleQuery.eq('id', profile.work_schedule_id);
    } else {
      scheduleQuery = scheduleQuery.eq('is_default', true);
    }
    
    const { data: scheduleData } = await scheduleQuery.limit(1).single();
    
    if (scheduleData) {
      const today = new Date();
      // Check if weekend (0 = Sunday, 1 = Monday... 5 = Friday, 6 = Saturday in JS, but depends on array in DB)
      // scheduleData.weekend_days usually contains ['Friday', 'Saturday']
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today);
      const isWeekend = scheduleData.weekend_days?.includes(dayName);
      
      if (!isWeekend && scheduleData.start_time) {
        // Build expected start time Date object
        const [hours, minutes] = scheduleData.start_time.split(':').map(Number);
        const expectedStart = new Date(today);
        expectedStart.setHours(hours, minutes, 0, 0);
        
        // Add grace period
        const gracePeriodMs = (scheduleData.grace_period_minutes || 0) * 60000;
        const allowedStart = new Date(expectedStart.getTime() + gracePeriodMs);
        
        if (today > allowedStart) {
          initialStatus = 'late';
        }
      }
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: employeeId,
        department_id: profile?.department_id,
        work_schedule_id: scheduleData?.id,
        check_in: now,
        check_in_location: location,
        check_in_device_id: deviceId,
        check_in_snapshot_url: snapshotUrl,
        notes: isDevicePending ? (notes ? notes + ' - (تم التسجيل من جهاز غير معتمد)' : '(تم التسجيل من جهاز غير معتمد)') : notes,
        status: initialStatus,
        is_device_pending: isDevicePending
      })
      .select()
      .single();

    if (error) throw error;
    
    const savedRecord = data as AttendanceRecord;
    try {
      const todayStr = now.split('T')[0];
      await this.enforceMandatoryPenalties(employeeId, todayStr, savedRecord);
    } catch (e) {
      console.error('Error applying mandatory penalties in checkIn:', e);
    }
    
    return savedRecord;
  },

  async checkOut(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false, snapshotUrl?: string, additionalNotes?: string) {
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) {
      throw new Error('لم يتم تسجيل الحضور اليوم');
    }

    // Check device match
    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_device_id')
      .eq('id', employeeId)
      .single();

    let isDevicePending = false;

    if (!profile?.primary_device_id && deviceId) {
      await supabase
        .from('profiles')
        .update({ primary_device_id: deviceId })
        .eq('id', employeeId);
      const { data: userProfile } = await supabase.from('profiles').select('full_name').eq('id', employeeId).single();
      await notifyAdminsForDeviceChange(userProfile?.full_name || 'موظف');
    } else if (profile?.primary_device_id && profile.primary_device_id !== deviceId) {
      isDevicePending = true;
      await notifySupervisorsOfDeviceMismatch(employeeId, profile.primary_device_id, deviceId);
    }

    const now = new Date().toISOString();
    
    // We only update is_device_pending to true if it is true now, we don't clear it if it was true in check-in
    const updatedStatus = isDevicePending || todayRecord.is_device_pending;

    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_out: now,
        check_out_location: location,
        check_out_device_id: deviceId,
        check_out_verified_by_biometric: verifiedByBiometric,
        check_out_snapshot_url: snapshotUrl,
        notes: isDevicePending 
          ? (additionalNotes ? (todayRecord.notes ? `${todayRecord.notes} | ${additionalNotes} - (تم التسجيل من جهاز غير معتمد)` : `${additionalNotes} - (تم التسجيل من جهاز غير معتمد)`) : (todayRecord.notes ? `${todayRecord.notes} - (تم التسجيل من جهاز غير معتمد)` : '(تم التسجيل من جهاز غير معتمد)'))
          : (additionalNotes ? (todayRecord.notes ? `${todayRecord.notes} | ${additionalNotes}` : additionalNotes) : todayRecord.notes),
        is_device_pending: updatedStatus
      })
      .eq('id', todayRecord.id)
      .select()
      .single();

    if (error) throw error;
    
    const savedRecord = data as AttendanceRecord;
    try {
      const todayStr = now.split('T')[0];
      await this.enforceMandatoryPenalties(employeeId, todayStr, savedRecord);
    } catch (e) {
      console.error('Error applying mandatory penalties in checkOut:', e);
    }
    
    return savedRecord;

  },

  async getStats(employeeId: string, startDate: string, endDate: string) {
    const records = await this.getByEmployeeId(employeeId, startDate, endDate);
    
    const stats: AttendanceStats = {
      total_present: records.filter(r => r.status === 'present').length,
      total_absent: records.filter(r => r.status === 'absent').length,
      total_late: records.filter(r => r.status === 'late').length,
      total_early_leave: records.filter(r => r.status === 'early_leave').length,
      attendance_rate: 0
    };

    const total = records.length;
    stats.attendance_rate = total > 0 ? (stats.total_present / total) * 100 : 0;

    return stats;
  }
};

// =============================================
// Attendance Device Services
// =============================================

export const attendanceDeviceService = {
  async getAll() {
    const { data, error } = await supabase
      .from('attendance_devices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AttendanceDevice[];
  },

  async create(device: Omit<AttendanceDevice, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('attendance_devices')
      .insert(device)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceDevice;
  },

  async update(id: string, updates: Partial<AttendanceDevice>) {
    const { data, error } = await supabase
      .from('attendance_devices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceDevice;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('attendance_devices')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// =============================================
// Attendance Exception Services
// =============================================

export const attendanceExceptionService = {
  async create(exception: Omit<AttendanceException, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .insert(exception)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceException;
  },

  async getByEmployeeId(employeeId: string) {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .select('*')
      .eq('employee_id', employeeId)
      .order('exception_date', { ascending: false });
    if (error) throw error;
    return data as AttendanceException[];
  },

  async updateStatus(id: string, status: 'approved' | 'rejected', approvedBy: string) {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .update({
        status,
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceException;
  },

  async getAllPending() {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AttendanceException[];
  }
};

// Biometric Verification Service has been moved to webauthnService.ts
