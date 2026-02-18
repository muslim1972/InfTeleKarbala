import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';

const RequestsPage: React.FC = () => {
  const navigate = useNavigate();

  const requestTypes = [
    {
      id: 'leave',
      title: 'طلب إجازة',
      description: 'تقديم طلب إجازة جديد ومتابعة حالته',
      icon: <CalendarCheck size={40} className="text-blue-500" />,
      path: '/requests/leave',
      color: 'bg-blue-50 text-blue-700',
    },
    // Future request types can be added here
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className={`w-16 h-16 rounded-xl ${type.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              {type.icon}
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {type.title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {type.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RequestsPage;
