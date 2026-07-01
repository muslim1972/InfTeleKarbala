import { supabase } from '../../../lib/supabase';
import type { WorkLocation } from '../types';

export const workLocationService = {
  /**
   * Fetches all work locations
   */
  async getAllLocations(): Promise<WorkLocation[]> {
    const { data, error } = await supabase
      .from('work_locations')
      .select('*')
      .order('name');
    if (error) throw error;
    return data as WorkLocation[];
  },

  /**
   * Creates a new work location
   */
  async createLocation(location: Omit<WorkLocation, 'id' | 'created_at' | 'updated_at'>): Promise<WorkLocation> {
    const { data, error } = await supabase
      .from('work_locations')
      .insert(location)
      .select()
      .single();
    if (error) throw error;
    return data as WorkLocation;
  },

  /**
   * Updates an existing work location
   */
  async updateLocation(id: string, updates: Partial<WorkLocation>): Promise<WorkLocation> {
    const { data, error } = await supabase
      .from('work_locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as WorkLocation;
  },

  /**
   * Deletes a work location
   */
  async deleteLocation(id: string): Promise<void> {
    const { error } = await supabase
      .from('work_locations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Toggles a work location's active status
   */
  async toggleLocationActive(id: string, isActive: boolean): Promise<WorkLocation> {
    const { data, error } = await supabase
      .from('work_locations')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as WorkLocation;
  },

  /**
   * Fetches all employees assigned to a specific work location
   */
  async getLocationEmployees(locationId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('work_location_employees')
      .select(`
        id,
        location_id,
        employee_id,
        shift_start,
        shift_end,
        employee:profiles (
          id,
          full_name,
          job_number,
          role
        )
      `)
      .eq('location_id', locationId);
      
    if (error) throw error;
    return data as any[];
  },

  /**
   * Assigns an employee to a work location
   */
  async assignEmployee(locationId: string, employeeId: string, shiftStart?: string, shiftEnd?: string): Promise<void> {
    const { error } = await supabase
      .from('work_location_employees')
      .insert({
        location_id: locationId,
        employee_id: employeeId,
        shift_start: shiftStart || null,
        shift_end: shiftEnd || null
      });
    if (error) throw error;
  },

  /**
   * Removes an employee's assignment from a work location
   */
  async removeEmployee(locationId: string, employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('work_location_employees')
      .delete()
      .eq('location_id', locationId)
      .eq('employee_id', employeeId);
    if (error) throw error;
  },

  /**
   * Searches for profiles by name or job number
   */
  async searchEmployees(query: string): Promise<any[]> {
    if (!query || query.trim() === '') return [];
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, job_number, role')
      .or(`full_name.ilike.%${query}%,job_number.ilike.%${query}%`)
      .limit(10);
      
    if (error) throw error;
    return data || [];
  }
};
