import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface GovernorateContextType {
    activeGovernorate: string;
    setActiveGovernorate: (gov: string) => void;
    availableGovernorates: { id: string; name: string; isActive: boolean }[];
    canChangeGovernorate: boolean;
}

const GovernorateContext = createContext<GovernorateContextType>({
    activeGovernorate: 'karbala',
    setActiveGovernorate: () => {},
    availableGovernorates: [],
    canChangeGovernorate: false,
});

export const GovernorateProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [availableGovernorates, setAvailableGovernorates] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
    
    // Developer can change it. Others are locked to their profile's governorate.
    const canChangeGovernorate = user?.admin_role === 'developer';

    // State for the active governorate
    const [activeGovernorate, setInternalActiveGovernorate] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        // 1. If user is logged in and CANNOT change it, lock to their profile
        if (user && !canChangeGovernorate && user.governorate) {
            return user.governorate;
        }
        // 2. Otherwise, check session storage (set from login screen or by developer)
        const stored = sessionStorage.getItem('selectedGovernorate');
        return stored || (user?.governorate || '');
    });

    // Sync when user changes
    useEffect(() => {
        if (user) {
            if (!canChangeGovernorate && user.governorate) {
                setInternalActiveGovernorate(user.governorate);
                sessionStorage.setItem('selectedGovernorate', user.governorate);
            } else if (canChangeGovernorate) {
                // If developer just logged in, ensure we keep whatever they had, or default to their profile
                const stored = sessionStorage.getItem('selectedGovernorate');
                if (!stored && user.governorate) {
                    setInternalActiveGovernorate(user.governorate);
                    sessionStorage.setItem('selectedGovernorate', user.governorate);
                }
            }
        }
    }, [user, canChangeGovernorate]);

    // Fetch available cards for the switcher UI
    useEffect(() => {
        let isMounted = true;
        supabase.from('governorate_cards').select('id, is_active, name')
            .then(({ data }) => {
                if (isMounted && data) {
                    setAvailableGovernorates(data.map(d => ({
                        id: d.id,
                        name: d.name || d.id,
                        isActive: d.is_active
                    })));
                }
            })
            .catch(err => console.warn('Failed to fetch governorates:', err));
            
        return () => { isMounted = false; };
    }, []);

    const setActiveGovernorate = (gov: string) => {
        if (!user || canChangeGovernorate || gov === '') {
            setInternalActiveGovernorate(gov);
            if (gov) {
                sessionStorage.setItem('selectedGovernorate', gov);
            } else {
                sessionStorage.removeItem('selectedGovernorate');
            }
        } else {
            console.warn('Unauthorized attempt to change governorate.');
        }
    };

    return (
        <GovernorateContext.Provider value={{ activeGovernorate, setActiveGovernorate, availableGovernorates, canChangeGovernorate }}>
            {children}
        </GovernorateContext.Provider>
    );
};

export const useGovernorate = () => useContext(GovernorateContext);
