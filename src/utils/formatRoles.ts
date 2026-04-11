
/**
 * Maps user roles and admin roles to their display labels in Arabic.
 * 
 * @param user The user object containing role and admin_role
 * @returns A string representing the user's role in Arabic
 */
export const getRoleLabel = (user: any): string => {
    if (!user) return 'زائر';
    
    // Check if the user is an admin with a specific admin_role
    if (user.role === 'admin' && user.admin_role) {
        switch (user.admin_role) {
            case 'developer':
                return 'مطور';
            case 'general':
                return 'مشرف عام';
            case 'finance':
                return 'مشرف مالية';
            case 'hr':
                return 'مشرف ادارة';
            case 'media':
                return 'مشرف اعلام';
            case 'capacities':
                return 'مشرف السعات';
            default:
                return 'موظف';
        }
    }
    
    // Default for regular employees (including admin with null admin_role)
    return 'موظف';
};

/**
 * Maps an Arabic role label back to the database values (role, admin_role).
 */
export const roleLabelToDb = (label: string): { role: string; admin_role: string | null } => {
    switch (label) {
        case 'مشرف عام':
            return { role: 'admin', admin_role: 'general' };
        case 'مشرف مالية':
            return { role: 'admin', admin_role: 'finance' };
        case 'مشرف ادارة':
            return { role: 'admin', admin_role: 'hr' };
        case 'مشرف اعلام':
            return { role: 'admin', admin_role: 'media' };
        case 'مشرف السعات':
            return { role: 'admin', admin_role: 'capacities' };
        case 'موظف':
        default:
            return { role: 'user', admin_role: null };
    }
};

/** All available role labels for the permission dropdown (excludes مطور) */
export const ROLE_OPTIONS = [
    'موظف',
    'مشرف عام',
    'مشرف مالية',
    'مشرف ادارة',
    'مشرف اعلام',
    'مشرف السعات',
] as const;
