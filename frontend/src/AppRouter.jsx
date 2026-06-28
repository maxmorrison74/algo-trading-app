import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OmniApp from './OmniApp';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';

// Mock auth check (To be replaced with real JWT logic)
const isAuthenticated = () => {
  return localStorage.getItem('token') !== null;
};

const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route 
          path="/dashboard/*" 
          element={
            <ProtectedRoute>
              <OmniApp />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
