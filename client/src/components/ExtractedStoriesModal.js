import React from 'react';
import { X, Sparkles, Clock, Heart, MessageCircle } from 'lucide-react';

const ExtractedStoriesModal = ({ isOpen, onClose, stories, onCreateStory }) => {
  if (!isOpen) return null;

  const toneColors = {
    casual: 'bg-green-100 text-green-800',
    funny: 'bg-yellow-100 text-yellow-800',
    thoughtful: 'bg-blue-100 text-blue-800',
    'self-deprecating': 'bg-purple-100 text-purple-800',
    dramatic: 'bg-red-100 text-red-800',
    surprising: 'bg-orange-100 text-orange-800',
    relatable: 'bg-pink-100 text-pink-800'
  };

  const toneIcons = {
    casual: '💬',
    funny: '😄',
    thoughtful: '🤔',
    'self-deprecating': '😅',
    dramatic: '🎭',
    surprising: '😲',
    relatable: '🤝'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Sparkles className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Story Ideas Found
              </h2>
              <p className="text-sm text-gray-600">
                {stories.length} potential story{stories.length > 1 ? 'ies' : ''} extracted from your journal entry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {stories.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Story Ideas Found
              </h3>
              <p className="text-gray-600">
                This journal entry doesn't contain any obvious story-worthy moments. 
                Try writing about specific events, interactions, or observations that others might find interesting.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {stories.map((story, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {story.title}
                      </h3>
                      <div className="flex items-center space-x-2 mb-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${toneColors[story.tone] || 'bg-gray-100 text-gray-800'}`}>
                          {toneIcons[story.tone] || '💭'} {story.tone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Heart className="w-4 h-4 mr-2 text-red-500" />
                        What Happened
                      </h4>
                      <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {story.core_event}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <MessageCircle className="w-4 h-4 mr-2 text-blue-500" />
                        Why It's Interesting
                      </h4>
                      <p className="text-gray-600 bg-blue-50 p-3 rounded-lg">
                        {story.interest_reason}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => onCreateStory(story)}
                      className="btn-primary text-sm flex items-center"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Story
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            💡 Tip: Click "Create Story" to turn any idea into a polished conversation story
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtractedStoriesModal;




