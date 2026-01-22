import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  BookOpen, 
  MessageSquare, 
  Play, 
  User, 
  Menu, 
  X,
  LogOut,
  Home,
  Users,
  Laugh,
  Heart,
  Brain,
  Target as TargetIcon,
  Dna,
  Bot,
  AlertTriangle,
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef(null);

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Journal', href: '/journal', icon: BookOpen },
    { name: 'Stories', href: '/stories', icon: MessageSquare },
    { name: 'Practice', href: '/practice', icon: Play },
    { name: 'People', href: '/people', icon: Users },
    { name: 'Jokes', href: '/jokes', icon: Laugh },
    { name: 'Wellness', href: '/wellness', icon: Heart },
    { name: 'Coach', href: '/coach', icon: Brain },
    { name: 'Identity', href: '/identity', icon: User },
    { name: 'Goals', href: '/goals', icon: TargetIcon },
    { name: 'Genome', href: '/genome', icon: Dna },
    { name: 'AI Chat', href: '/chat', icon: Bot },
    { name: 'Triggers', href: '/triggers', icon: AlertTriangle }
  ];

  const primaryNav = useMemo(() => {
    const primary = new Set(['Home', 'Journal', 'Stories', 'Practice', 'People', 'AI Chat']);
    return navigation.filter((i) => primary.has(i.name));
  }, [navigation]);

  const moreNav = useMemo(() => {
    const primary = new Set(['Home', 'Journal', 'Stories', 'Practice', 'People', 'AI Chat']);
    return navigation.filter((i) => !primary.has(i.name));
  }, [navigation]);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    setIsMoreOpen(false);
  };

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Close "More" on outside click / Esc
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!isMoreOpen) return;
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setIsMoreOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMoreOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and main navigation */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">StoryConnect</span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:ml-8 md:flex md:items-center md:space-x-5">
              {primaryNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'text-primary-600 border-b-2 border-primary-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}

              {/* More dropdown */}
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen((v) => !v)}
                  className={`inline-flex items-center px-2 pt-1 text-sm font-medium transition-colors duration-200 ${
                    moreNav.some((i) => isActive(i.href))
                      ? 'text-primary-600 border-b-2 border-primary-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={isMoreOpen}
                >
                  <MoreHorizontal className="w-4 h-4 mr-2" />
                  More
                  <ChevronDown className="w-4 h-4 ml-1" />
                </button>

                {isMoreOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                  >
                    {moreNav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`flex items-center px-4 py-2 text-sm transition-colors ${
                            isActive(item.href) ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          role="menuitem"
                          onClick={() => setIsMoreOpen(false)}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-4">
            {/* Desktop user menu */}
            <div className="hidden md:flex md:items-center md:space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user?.name}</span>
              <Link
                to="/profile"
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <User className="w-5 h-5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
            
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="px-3 py-2 text-sm text-gray-700">
                Welcome, {user?.name}
              </div>
              <Link
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors duration-200"
              >
                <User className="w-5 h-5 mr-3" />
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors duration-200"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
