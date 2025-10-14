import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Mic, MicOff, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Practice = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [practiceScenarios, setPracticeScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for practice scenarios
    setPracticeScenarios([
      {
        id: 1,
        title: "Coffee Shop Order",
        description: "Practice ordering coffee and making small talk with the barista",
        difficulty: "Easy",
        duration: "2-3 minutes",
        tips: [
          "Start with a simple greeting",
          "Ask about their day",
          "Comment on the weather or coffee"
        ]
      },
      {
        id: 2,
        title: "Elevator Conversation",
        description: "Practice making conversation in an elevator with a neighbor",
        difficulty: "Medium",
        duration: "1-2 minutes",
        tips: [
          "Keep it brief and friendly",
          "Comment on something neutral",
          "Don't force the conversation"
        ]
      },
      {
        id: 3,
        title: "Party Introduction",
        description: "Practice introducing yourself at a social gathering",
        difficulty: "Hard",
        duration: "5-10 minutes",
        tips: [
          "Have a memorable introduction ready",
          "Ask open-ended questions",
          "Listen actively and respond thoughtfully"
        ]
      }
    ]);
    setLoading(false);
  }, []);

  const startRecording = () => {
    setIsRecording(true);
    toast.success("Recording started");
  };

  const stopRecording = () => {
    setIsRecording(false);
    toast.success("Recording stopped");
  };

  const startPractice = () => {
    setIsPlaying(true);
    toast.success("Practice session started");
  };

  const stopPractice = () => {
    setIsPlaying(false);
    toast.success("Practice session ended");
  };

  const resetPractice = () => {
    setIsPlaying(false);
    setIsRecording(false);
    toast.success("Practice reset");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading practice scenarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Practice Conversations</h1>
          <p className="text-gray-600">Improve your social skills through guided practice sessions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Practice Scenarios */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Choose a Scenario</h2>
            <div className="space-y-4">
              {practiceScenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedScenario?.id === scenario.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedScenario(scenario)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{scenario.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      scenario.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                      scenario.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {scenario.difficulty}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{scenario.description}</p>
                  <p className="text-gray-500 text-xs">Duration: {scenario.duration}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Practice Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Practice Session</h2>
            
            {selectedScenario ? (
              <div>
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">{selectedScenario.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{selectedScenario.description}</p>
                  
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Tips:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedScenario.tips.map((tip, index) => (
                        <li key={index} className="text-sm text-gray-600">{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Practice Controls */}
                <div className="flex items-center justify-center space-x-4 mb-6">
                  <button
                    onClick={isPlaying ? stopPractice : startPractice}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                      isPlaying
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    <span>{isPlaying ? 'Stop' : 'Start'} Practice</span>
                  </button>
                  
                  <button
                    onClick={resetPractice}
                    className="flex items-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Recording Controls */}
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isRecording
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    <span>{isRecording ? 'Stop Recording' : 'Record'}</span>
                  </button>
                  
                  <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Volume2 className="h-5 w-5" />
                    <span>Playback</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Play className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Scenario</h3>
                <p className="text-gray-600">Choose a practice scenario from the left to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Practice;



