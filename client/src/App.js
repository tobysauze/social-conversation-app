import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Journal from './pages/Journal';
import Stories from './pages/Stories';
import Practice from './pages/Practice';
import Profile from './pages/Profile';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';
import Jokes from './pages/Jokes';
import Wellness from './pages/Wellness';
import Coach from './pages/Coach';
import Identity from './pages/Identity';
import Goals from './pages/Goals';
import Genome from './pages/Genome';
import Chat from './pages/Chat';
import Triggers from './pages/Triggers';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return user ? children : <Navigate to="/login" />;
};

// Public Route component (redirect to home if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return user ? <Navigate to="/" /> : children;
};

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      
      <main className={user ? 'pt-16' : ''}>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } 
          />
          
          {/* Protected routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/journal" 
            element={
              <ProtectedRoute>
                <Journal />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/stories" 
            element={
              <ProtectedRoute>
                <Stories />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/practice" 
            element={
              <ProtectedRoute>
                <Practice />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/wellness" 
            element={
              <ProtectedRoute>
                <Wellness />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/people" 
            element={
              <ProtectedRoute>
                <People />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/people/:id" 
            element={
              <ProtectedRoute>
                <PersonDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/jokes" 
            element={
              <ProtectedRoute>
                <Jokes />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/identity" 
            element={
              <ProtectedRoute>
                <Identity />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/goals" 
            element={
              <ProtectedRoute>
                <Goals />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/coach" 
            element={
              <ProtectedRoute>
                <Coach />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/genome"
            element={
              <ProtectedRoute>
                <Genome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/triggers"
            element={
              <ProtectedRoute>
                <Triggers />
              </ProtectedRoute>
            }
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
