import { supabase } from '../../../lib/supabase';
import type { WorkLocation } from '../types';

export const geofenceService = {
  /**
   * Calculates the distance between two geographical points using the Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  },

  /**
   * Checks if user coordinates are within the radius of a specific work location
   */
  isWithinGeofence(userLat: number, userLon: number, location: WorkLocation): boolean {
    const distance = this.calculateDistance(userLat, userLon, location.latitude, location.longitude);
    return distance <= location.radius_meters;
  },

  /**
   * Fetches all work locations assigned to an employee
   */
  async getEmployeeLocations(employeeId: string): Promise<WorkLocation[]> {
    const { data, error } = await supabase
      .from('work_location_employees')
      .select('*, location:work_locations(*)')
      .eq('employee_id', employeeId);

    if (error) throw error;
    
    // Extract and return valid active locations
    return (data as any[])
      .map(item => item.location)
      .filter((loc): loc is WorkLocation => loc !== null && loc.is_active === true);
  },

  /**
   * Checks if the employee is within any of their assigned geofences
   */
  async checkEmployeeGeofence(
    employeeId: string,
    userLat: number,
    userLon: number
  ): Promise<{ allowed: boolean; nearestLocation?: WorkLocation; distance?: number }> {
    try {
      const locations = await this.getEmployeeLocations(employeeId);
      
      if (locations.length === 0) {
        // If employee has no assigned locations, they are not allowed to check in anywhere
        return { allowed: false };
      }

      let nearestLocation: WorkLocation | undefined = undefined;
      let minDistance = Infinity;

      for (const loc of locations) {
        const distance = this.calculateDistance(userLat, userLon, loc.latitude, loc.longitude);
        if (distance < minDistance) {
          minDistance = distance;
          nearestLocation = loc;
        }
        
        // If user is within this location's radius, they are allowed
        if (distance <= loc.radius_meters) {
          return { allowed: true, nearestLocation: loc, distance };
        }
      }

      return {
        allowed: false,
        nearestLocation,
        distance: Math.round(minDistance)
      };
    } catch (error) {
      console.error('Error checking employee geofence:', error);
      return { allowed: false };
    }
  }
};
