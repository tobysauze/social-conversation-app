import React, { useState, useEffect } from 'react';
import { X, UserPlus, Check, X as XIcon, Brain, Users, Lightbulb } from 'lucide-react';
import { peopleAPI } from '../services/api';
import toast from 'react-hot-toast';

const ProfileSuggestionsModal = ({ isOpen, onClose, suggestions, onApplyInsights }) => {
  const [applyingInsights, setApplyingInsights] = useState({});
  const [appliedInsights, setAppliedInsights] = useState({});

  // Reset applied insights when modal opens with new suggestions
  useEffect(() => {
    if (isOpen) {
      setAppliedInsights({});
      setApplyingInsights({});
    }
  }, [isOpen, suggestions]);

  const handleApplyInsights = async (personId, insights, personName) => {
    console.log('Applying insights:', { personId, insights });
    setApplyingInsights(prev => ({ ...prev, [personId]: true }));
    try {
      const response = await peopleAPI.applyInsights(personId, insights);
      console.log('Apply insights response:', response);
      toast.success(`Insights applied to ${personName}'s profile!`);
      
      // Mark this insight as applied
      setAppliedInsights(prev => ({ ...prev, [personId]: true }));
      
      // Don't call onApplyInsights here - let user apply to multiple people
    } catch (error) {
      console.error('Error applying insights:', error);
      console.error('Error response:', error.response?.data);
      toast.error(`Failed to apply insights: ${error.response?.data?.error || error.message}`);
    } finally {
      setApplyingInsights(prev => ({ ...prev, [personId]: false }));
    }
  };

  const handleCreateNewPerson = async (suggestion) => {
    try {
      const personData = {
        name: suggestion.person_name,
        interests: suggestion.new_insights.interests || [],
        personality_traits: suggestion.new_insights.personality_traits || [],
        conversation_style: suggestion.new_insights.conversation_style || '',
        story_preferences: suggestion.new_insights.preferences || [],
        notes: suggestion.new_insights.observations || ''
      };

      await peopleAPI.createPerson(personData);
      toast.success(`Created new person: ${suggestion.person_name}`);
      
      // Mark this as applied (using person_name as key since it's a new person)
      setAppliedInsights(prev => ({ ...prev, [suggestion.person_name]: true }));
      
      // Don't call onApplyInsights here - let user create multiple people
    } catch (error) {
      console.error('Error creating person:', error);
      toast.error('Failed to create person');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Brain className="w-6 h-6 mr-3 text-primary-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Profile Insights Detected
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                AI found information about people in your journal entry
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {suggestions.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No people detected
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No people were mentioned in this journal entry, or the AI couldn't extract clear insights.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
                        <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {suggestion.person_name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            suggestion.is_existing_person 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {suggestion.is_existing_person ? 'Existing Person' : 'New Person'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Confidence: {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {suggestion.new_insights.interests && suggestion.new_insights.interests.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                          <Lightbulb className="w-4 h-4 mr-2" />
                          New Interests
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.new_insights.interests.map((interest, idx) => (
                            <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestion.new_insights.personality_traits && suggestion.new_insights.personality_traits.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Personality Traits
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.new_insights.personality_traits.map((trait, idx) => (
                            <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestion.new_insights.conversation_style && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Conversation Style
                        </h4>
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                          {suggestion.new_insights.conversation_style}
                        </span>
                      </div>
                    )}

                    {suggestion.new_insights.observations && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Observations
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          {suggestion.new_insights.observations}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => onClose()}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Skip
                    </button>
                    
                    {suggestion.is_existing_person && suggestion.existing_person_id ? (
                      <button
                        onClick={() => handleApplyInsights(suggestion.existing_person_id, suggestion.new_insights, suggestion.person_name)}
                        disabled={applyingInsights[suggestion.existing_person_id] || appliedInsights[suggestion.existing_person_id]}
                        className={`flex items-center ${
                          appliedInsights[suggestion.existing_person_id] 
                            ? 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg' 
                            : 'btn-primary'
                        }`}
                      >
                        {applyingInsights[suggestion.existing_person_id] ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Applying...
                          </>
                        ) : appliedInsights[suggestion.existing_person_id] ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Applied ✓
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Apply to Profile
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCreateNewPerson(suggestion)}
                        disabled={appliedInsights[suggestion.person_name]}
                        className={`flex items-center ${
                          appliedInsights[suggestion.person_name] 
                            ? 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg' 
                            : 'btn-primary'
                        }`}
                      >
                        {appliedInsights[suggestion.person_name] ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Created ✓
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Create New Person
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {Object.keys(appliedInsights).length > 0 && (
              <span className="text-green-600 dark:text-green-400">
                ✓ {Object.keys(appliedInsights).length} insight{Object.keys(appliedInsights).length > 1 ? 's' : ''} applied
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={onClose}
              className="btn-secondary"
            >
              Close
            </button>
            {Object.keys(appliedInsights).length > 0 && (
              <button 
                onClick={() => {
                  onApplyInsights && onApplyInsights();
                  onClose();
                }}
                className="btn-primary"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSuggestionsModal;
