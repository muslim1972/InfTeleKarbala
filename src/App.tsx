import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AuthProvider, useAuth } from "./context/AuthContext";

const AppContent = () => {
  const { user } = useAuth();

  if (!user) return <Login />;

  // توجيه المستخدم حسب الصلاحية
  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  return <Dashboard />;
};

function App() {
  return (
    <div dir="rtl">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  );
}

export default App;
