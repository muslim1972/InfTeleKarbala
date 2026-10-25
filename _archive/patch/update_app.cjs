const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

c = c.replace(
  'import { isDeveloperLevel } from "./utils/permissions";',
  'import { isDeveloperLevel, canAccessHR } from "./utils/permissions";'
);

c = c.replace(
  'const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));',
  'const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));\r\nconst HRDashboard = lazy(() => import("./pages/HRDashboard").then(m => ({ default: m.HRDashboard })));'
);

c = c.replace(
  "const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user' | 'capacities' | 'promotion' | 'training' | 'user_incentives' | 'attendance' | null>",
  "const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user' | 'capacities' | 'promotion' | 'training' | 'user_incentives' | 'attendance' | 'hr' | null>"
);

c = c.replace(
  "if (!['capacities', 'promotion', 'training', 'user_incentives', 'attendance'].includes(adminViewMode))",
  "if (!['capacities', 'promotion', 'training', 'user_incentives', 'attendance', 'hr'].includes(adminViewMode))"
);

c = c.replace(
  "  const hasTraining = user.is_training_supervisor === true || isAdmin || isDeveloperLevel(user.admin_role) || user.admin_role === 'general';\r\n  const needsRoleSelection = true;",
  "  const hasTraining = user.is_training_supervisor === true || isAdmin || isDeveloperLevel(user.admin_role) || user.admin_role === 'general';\r\n  const hasHR = canAccessHR(user);\r\n  const needsRoleSelection = true;"
);

c = c.replace(
  "<AdminRoleSelector onSelect={setAdminViewMode as any} hasCapacities={hasCapacities} hasPromotion={hasPromotion} hasTraining={hasTraining} />;",
  "<AdminRoleSelector onSelect={setAdminViewMode as any} hasCapacities={hasCapacities} hasPromotion={hasPromotion} hasTraining={hasTraining} hasHR={hasHR} />;"
);

const hrViewBlock = '    // عرض واجهة الموارد البشرية\r\n    if (adminViewMode === \'hr\') {\r\n      return (\r\n        <ErrorBoundary onReset={() => setAdminViewMode(null)} resetText="العودة للصفحة الرئيسية" fallbackTitle="حدث خطأ في واجهة الموارد البشرية">\r\n          <HRDashboard onBack={() => setAdminViewMode(null)} />\r\n        </ErrorBoundary>\r\n      );\r\n    }\r\n';

c = c.replace('    // عرض الواجهة المختارة', hrViewBlock + '    // عرض الواجهة المختارة');

fs.writeFileSync('src/App.tsx', c, 'utf8');
console.log('App.tsx updated successfully');
