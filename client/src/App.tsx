import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import IntakeForm from './pages/IntakeForm';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import SubmissionDetail from './pages/SubmissionDetail';
import { useAuth } from './lib/auth';

function RequireAdmin({ children }: { children: ReactElement }): ReactElement {
  const { admin, loading } = useAuth();
  if (loading) return <div className="admin-loading">Loading…</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IntakeForm />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/submissions/:id"
        element={
          <RequireAdmin>
            <SubmissionDetail />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
