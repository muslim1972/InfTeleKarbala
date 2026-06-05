import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { AdminTrainingTab } from "../../features/training/components/AdminTrainingTab";
import { TraineeLoginPage } from "../../features/training/components/TraineeLoginPage";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";

export const TrainingTabContent = ({ isAdmin = false }: { isAdmin?: boolean }) => {
    const { user } = useAuth();
    const [isSupervisor, setIsSupervisor] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const checkSupervisor = async () => {
            if (!user || user.role === 'visitor') {
                setLoadingAuth(false);
                return;
            }

            if (isAdmin) {
                // Admins have full access anyway
                setIsSupervisor(true);
                setLoadingAuth(false);
                return;
            }

            try {
                // Check if current user is a training supervisor
                const { data, error } = await supabase
                    .from('profiles')
                    .select('is_training_supervisor')
                    .eq('id', user.id)
                    .single();

                if (!error && data?.is_training_supervisor) {
                    setIsSupervisor(true);
                }
            } catch (err) {
                console.error("Failed to check supervisor status:", err);
            }
            setLoadingAuth(false);
        };

        checkSupervisor();
    }, [user, isAdmin]);

    if (loadingAuth) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    // 1. If Admin or explicitly assigned Supervisor -> Show Admin Tab
    if (isAdmin || isSupervisor) {
        return <AdminTrainingTab isAdminView={isAdmin} />;
    }

    // 2. Otherwise (Visitor or regular employee) -> Show Trainee Login Interface
    return <TraineeLoginPage />;
};
