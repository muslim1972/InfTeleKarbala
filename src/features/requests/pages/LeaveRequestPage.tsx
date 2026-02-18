import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LeaveRequestForm from '../components/LeaveRequestForm';
import { Layout } from '../../../components/layout/Layout';

const LeaveRequestPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout headerTitle="طلب إجازة" showUserName={true}>
      <div className="max-w-4xl mx-auto mt-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate('/requests')}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">طلب إجازة</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">تقديم طلب إجازة رسمي جديد</p>
          </div>
        </div>

        <LeaveRequestForm onSuccess={() => { }} />
      </div>
    </Layout>
  );
};

export default LeaveRequestPage;
