SELECT get_active_visitors_by_range(CURRENT_DATE - 1, CURRENT_DATE, 'karbala') -> 'total_staff' as staff,
       get_active_visitors_by_range(CURRENT_DATE - 1, CURRENT_DATE, 'karbala') -> 'total_visitors' as active,
       get_active_visitors_by_range(CURRENT_DATE - 1, CURRENT_DATE, 'karbala') -> 'inactive_count' as inactive;
