import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Save, RotateCcw } from 'lucide-react';
import { jokesAPI } from '../services/api';

const JokeIterationModal = ({ isOpen, onClose, joke, onSaveImproved }) => {
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentJoke, setCurrentJoke] = useState(joke);
  const [aiResponse, setAiResponse] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && joke) {
      setCurrentJoke(joke);
      setConversationHistory([]);
      setAiResponse(null);
      setCurrentMessage('');
      // Start with AI's first suggestion
      handleAIIteration();
    }
  }, [isOpen, joke]);

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory, aiResponse]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAIIteration = async () => {
    setIsLoading(true);
    try {
      const response = await jokesAPI.iterateJoke(joke.id, conversationHistory);
      setAiResponse(response);
      
      // Add AI's response to conversation history
      const newMessage = {
        role: 'assistant',
        content: `Here's my improved version:\n\n**${response.improved_joke.title}**\n\n${response.improved_joke.content}\n\n**What I changed:** ${response.explanation}\n\n**Additional suggestions:**\n${response.suggestions.map(s => `• ${s}`).join('\n')}`
      };
      
      setConversationHistory(prev => [...prev, newMessage]);
    } catch (error) {
      console.error('Error getting AI iteration:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error while trying to improve your joke. Please try again!'
      };
      setConversationHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: currentMessage.trim()
    };

    setConversationHistory(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await jokesAPI.iterateJoke(joke.id, [...conversationHistory, userMessage]);
      setAiResponse(response);
      
      const aiMessage = {
        role: 'assistant',
        content: response.explanation
      };
      
      setConversationHistory(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again!'
      };
      setConversationHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveImproved = () => {
    if (aiResponse && aiResponse.improved_joke) {
      onSaveImproved(aiResponse.improved_joke);
      onClose();
    }
  };

  const handleReset = () => {
    setConversationHistory([]);
    setAiResponse(null);
    setCurrentMessage('');
    handleAIIteration();
  };

  if (!isOpen || !joke) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Bot className="w-6 h-6 mr-2 text-blue-500" />
              AI Joke Iteration
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Collaborate with AI to improve your joke
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Original Joke Display */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Original Joke:</h3>
          <div className="bg-white dark:bg-gray-800 p-3 rounded border">
            <h4 className="font-medium text-gray-900 dark:text-white">{joke.title}</h4>
            <p className="text-gray-700 dark:text-gray-300 mt-1">{joke.content}</p>
            <div className="flex items-center space-x-2 mt-2">
              {joke.category && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {joke.category}
                </span>
              )}
              {joke.difficulty && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  {joke.difficulty}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversationHistory.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <div className="flex items-center mb-1">
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 mr-2" />
                  ) : (
                    <Bot className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-xs font-medium">
                    {message.role === 'user' ? 'You' : 'AI Comedy Writer'}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center">
                  <Bot className="w-4 h-4 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    AI is thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Improved Joke Display */}
        {aiResponse && aiResponse.improved_joke && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border-t border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">AI's Improved Version:</h3>
            <div className="bg-white dark:bg-gray-800 p-3 rounded border">
              <h4 className="font-medium text-gray-900 dark:text-white">{aiResponse.improved_joke.title}</h4>
              <p className="text-gray-700 dark:text-gray-300 mt-1">{aiResponse.improved_joke.content}</p>
              <div className="flex items-center space-x-2 mt-2">
                {aiResponse.improved_joke.category && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {aiResponse.improved_joke.category}
                  </span>
                )}
                {aiResponse.improved_joke.difficulty && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    {aiResponse.improved_joke.difficulty}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask AI to make specific changes or improvements..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Start Over
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            {aiResponse && aiResponse.improved_joke && (
              <button
                onClick={handleSaveImproved}
                className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Improved Joke
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JokeIterationModal;








