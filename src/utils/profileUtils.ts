import { supabase } from '../lib/supabase';

export interface ProfileDetails {
    id: string;
    full_name: string;
    job_number?: string;
    job_title?: string;
    department_id?: string;
    department_name?: string;
    role?: string;
    engineering_allowance?: number;
}

/**
 * Fetches profile details, financial records, and department names for a given list of user IDs.
 * Returns a map of user_id -> ProfileDetails for fast O(1) lookups.
 * Useful for resolving IDs in lists (like Leave Requests, Penalities, Tasks).
 */
export async function fetchProfilesMap(userIds: string[]): Promise<Record<string, ProfileDetails>> {
    const uniqueIds = [...new Set(userIds.filter(id => id && id.trim() !== ''))];
    if (uniqueIds.length === 0) return {};

    const profileMap: Record<string, ProfileDetails> = {};
    
    // 1. Fetch profiles
    const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, job_number, job_title, department_id, role')
        .in('id', uniqueIds);

    if (profError) {
        console.error("Error fetching profiles map:", profError);
        return {};
    }

    if (profiles) {
        profiles.forEach(p => {
            profileMap[p.id] = { ...p } as ProfileDetails;
        });
    }

    // 2. Fetch financial records (often needed for engineers or positions)
    const { data: finData } = await supabase
        .from('financial_records')
        .select('user_id, engineering_allowance')
        .in('user_id', uniqueIds);
    
    if (finData) {
        finData.forEach(f => {
            if (profileMap[f.user_id]) {
                profileMap[f.user_id].engineering_allowance = f.engineering_allowance || 0;
            }
        });
    }

    // 3. Fetch departments
    const deptIds = [...new Set(profiles?.map(p => p.department_id).filter(Boolean) as string[])];
    if (deptIds.length > 0) {
        const { data: depts } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', deptIds);
            
        const deptMap: Record<string, string> = {};
        if (depts) {
            depts.forEach(d => { deptMap[d.id] = d.name; });
            
            // Assign back to profiles
            Object.values(profileMap).forEach(p => {
                if (p.department_id && deptMap[p.department_id]) {
                    p.department_name = deptMap[p.department_id];
                }
            });
        }
    }

    return profileMap;
}
