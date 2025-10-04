import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { journalAPI, storiesAPI, practiceAPI } from '../services/api';
import { 
  BookOpen, 
  MessageSquare, 
  Play, 
  Plus, 
  TrendingUp,
  Clock,
  Star,
  ArrowRight,
  Calendar,
  Target
} from 'lucide-react';
import { format } from 'date-fns';

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    recentEntries: 0,
    totalStories: 0,
    practiceSessions: 0,
    avgRating: 0
  });
  const [recentEntries, setRecentEntries] = useState([]);
  const [recentStories, setRecentStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [entriesResponse, storiesResponse, practiceResponse] = await Promise.all([
        journalAPI.getEntries(1, 3),
        storiesAPI.getStories(1, 3),
        practiceAPI.getStats()
      ]);

      setRecentEntries(entriesResponse.data.entries || []);
      setRecentStories(storiesResponse.data.stories || []);
      setStats({
        recentEntries: entriesResponse.data.entries?.length || 0,
        totalStories: storiesResponse.data.stories?.length || 0,
        practiceSessions: practiceResponse.data.stats?.totalSessions || 0,
        avgRating: practiceResponse.data.stats?.avgRating || 0
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Write Journal Entry',
      description: 'Capture your thoughts and experiences',
      icon: BookOpen,
      href: '/journal',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'View Stories',
      description: 'Browse your conversation stories',
      icon: MessageSquare,
      href: '/stories',
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Practice Mode',
      description: 'Rehearse your stories with AI',
      icon: Play,
      href: '/practice',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    }
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name}! 👋
        </h1>
        <p className="text-gray-600">
          Ready to turn your experiences into engaging conversations?
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Recent Entries</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentEntries}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Stories</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalStories}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Practice Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.practiceSessions}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Rating</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.avgRating ? stats.avgRating.toFixed(1) : '0.0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                to={action.href}
                className={`${action.bgColor} rounded-xl p-6 hover:shadow-md transition-all duration-200 group`}
              >
                <div className="flex items-center mb-4">
                  <div className={`p-3 bg-gradient-to-r ${action.color} rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 ml-auto group-hover:text-gray-600 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {action.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {action.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Journal Entries */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Journal Entries</h2>
            <Link
              to="/journal"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
            >
              View all
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          {recentEntries.length > 0 ? (
            <div className="space-y-4">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="border-l-4 border-primary-200 pl-4 py-2">
                  <p className="text-sm text-gray-600 mb-1">
                    {format(new Date(entry.created_at), 'MMM d, yyyy')}
                  </p>
                  <p className="text-gray-900 text-sm line-clamp-2">
                    {entry.content.substring(0, 100)}
                    {entry.content.length > 100 && '...'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No journal entries yet</p>
              <Link
                to="/journal"
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Write your first entry
              </Link>
            </div>
          )}
        </div>

        {/* Recent Stories */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Stories</h2>
            <Link
              to="/stories"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
            >
              View all
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          {recentStories.length > 0 ? (
            <div className="space-y-4">
              {recentStories.map((story) => (
                <div key={story.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{story.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      story.tone === 'funny' ? 'bg-yellow-100 text-yellow-800' :
                      story.tone === 'thoughtful' ? 'bg-blue-100 text-blue-800' :
                      story.tone === 'casual' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {story.tone}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {story.content.substring(0, 80)}
                    {story.content.length > 80 && '...'}
                  </p>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="w-3 h-3 mr-1" />
                    {story.duration_seconds}s
                    {story.times_told > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        <Target className="w-3 h-3 mr-1" />
                        Told {story.times_told} times
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No stories created yet</p>
              <Link
                to="/journal"
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create your first story
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;

