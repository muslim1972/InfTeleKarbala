export interface FingerprintTemplate {
  id: string;
  employee_id: string;
  template_data: Uint8Array;
  template_version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  department_id?: string;
  check_in?: string;
  check_out?: string;
  check_in_location?: string;
  check_out_location?: string;
  check_in_verified_by_biometric: boolean;
  check_out_verified_by_biometric: boolean;
  check_in_device_id?: string;
  check_out_device_id?: string;
  notes?: string;
  status: 'present' | 'absent' | 'late' | 'early_leave';
  created_at: string;
  updated_at: string;
  verified_by?: string;
}

export interface AttendanceDevice {
  id: string;
  device_name: string;
  device_type: 'fingerprint_reader' | 'camera' | 'mobile';
  location?: string;
  department_id?: string;
  is_active: boolean;
  last_sync?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceException {
  id: string;
  employee_id: string;
  exception_date: string;
  exception_type: 'vacation' | 'sick_leave' | 'personal_leave' | 'business_trip';
  start_time?: string;
  end_time?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceStats {
  total_present: number;
  total_absent: number;
  total_late: number;
  total_early_leave: number;
  attendance_rate: number;
}

export interface BiometricVerificationResult {
  success: boolean;
  confidence: number;
  employee_id?: string;
  message: string;
}

export interface WorkLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkLocationEmployee {
  id: string;
  location_id: string;
  employee_id: string;
  location?: WorkLocation;
}

export interface WorkLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkLocationEmployee {
  id: string;
  location_id: string;
  employee_id: string;
  location?: WorkLocation;
}
