import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';

const RequestsPage: React.FC = () => {
  const navigate = useNavigate();

  const requestTypes = [
    {
      id: 'leave',
      title: 'الإجازات',
      description: 'تقديم طلب إجازة جديد ومتابعة حالته',
      icon: <CalendarCheck size={40} className="text-white drop-shadow-md" />,
      path: '/requests/leave',
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    },
    // Future request types can be added here
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">الطلبات</h1>
        <p className="text-gray-600 dark:text-gray-300">
          قم بإدارة وتقديم طلباتك الإدارية والمالية من مكان واحد.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requestTypes.map((type) => (
          <div
            key={type.id}
            onClick={() => navigate(type.path)}
            className={`${type.color} rounded-3xl p-6 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all cursor-pointer group flex items-center gap-6 relative overflow-hidden`}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50"></div>
            
            <div className={`w-20 h-20 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 z-10 border border-white/20 shadow-inner`}>
              {type.icon}
            </div>
            
            <div className="z-10">
              <h3 className="text-2xl font-bold text-white mb-1 tracking-wide">
                {type.title}
              </h3>
              <p className="text-blue-100/90 text-sm leading-relaxed">
                {type.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RequestsPage;
