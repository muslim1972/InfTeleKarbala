import { useNavigate } from "react-router-dom";
import { ShieldAlert, Home, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 text-center p-8">
          
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </motion.div>

          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-2 font-poppins tracking-tighter">
            404
          </h1>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 font-tajawal">
            الصفحة غير موجودة
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-8 font-tajawal leading-relaxed">
            عذراً، المسار الذي تحاول الوصول إليه غير موجود أو لا تملك الصلاحية للوصول إليه. يرجى التأكد من الرابط أو العودة للصفحة الرئيسية.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/", { replace: true })}
              className="w-full flex items-center justify-center space-x-2 space-x-reverse bg-brand-primary hover:bg-brand-primary/90 text-white py-3 px-4 rounded-xl transition-all font-tajawal shadow-lg shadow-brand-primary/20"
            >
              <Home className="w-5 h-5" />
              <span>العودة للرئيسية</span>
            </button>
            
            <button
              onClick={() => navigate(-1)}
              className="w-full flex items-center justify-center space-x-2 space-x-reverse bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 px-4 rounded-xl transition-all font-tajawal border border-gray-200 dark:border-gray-600"
            >
              <ArrowRight className="w-5 h-5" />
              <span>الرجوع للخلف</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
