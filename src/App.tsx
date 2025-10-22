import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import Chat from './pages/Chat';
import Kanban from './pages/Kanban';
import Settings from './pages/Settings';
import Registrations from './pages/Registrations';
import { ThemeProvider } from './components/providers/theme-provider';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Toaster } from 'sonner';
import { ApiSettingsProvider } from './contexts/ApiSettingsContext';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="chatvendas-theme">
      <AuthProvider>
        <ApiSettingsProvider>
          <Toaster richColors position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/conexoes" element={<Connections />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/kanban" element={<Kanban />} />
              <Route path="/cadastros" element={<Registrations />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Route>
          </Routes>
        </ApiSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
