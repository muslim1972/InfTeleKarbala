import { usePolls } from '../../hooks/usePolls';
import { PollItem } from './PollItem';
import { Loader2, PieChart } from 'lucide-react';

export function TrainingPollsList() {
    const { data: polls, isLoading } = usePolls('training');
    const activePolls = polls || [];

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>;
    }

    return (
        <div className="space-y-4">
            {activePolls.length > 0 ? (
                activePolls.map(poll => (
                    <PollItem key={poll.id} poll={poll} />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center border border-border">
                        <PieChart className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-bold text-sm">لا توجد استطلاعات للتدريب الصيفي حالياً</p>
                </div>
            )}
        </div>
    );
}
