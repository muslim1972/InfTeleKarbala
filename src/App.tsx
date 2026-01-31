import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";

const AppContent = () => {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Login />;
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
