import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import ClientLayout from './pages/client/ClientLayout';
import Dashboard from './pages/client/Dashboard';
import FoodLogger from './pages/client/FoodLogger';
import Measurements from './pages/client/Measurements';
import MyPlan from './pages/client/MyPlan';
import TrainerLayout from './pages/trainer/TrainerLayout';
import ClientList from './pages/trainer/ClientList';
import ClientDetail from './pages/trainer/ClientDetail';

function ProtectedRoute({ children, trainerOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)' }} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (trainerOnly && user.role !== 'trainer') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Client routes */}
          <Route path="/" element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="food" element={<FoodLogger />} />
            <Route path="measurements" element={<Measurements />} />
            <Route path="plan" element={<MyPlan />} />
          </Route>

          {/* Trainer routes */}
          <Route path="/trainer" element={<ProtectedRoute trainerOnly><TrainerLayout /></ProtectedRoute>}>
            <Route index element={<ClientList />} />
            <Route path="clients/:id" element={<ClientDetail />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
