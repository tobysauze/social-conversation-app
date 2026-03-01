import React from 'react';
import { Moon, Sparkles, X, HelpCircle } from 'lucide-react';

const DreamAnalysisModal = ({ isOpen, onClose, analysis }) => {
  if (!isOpen) return null;

  const a = analysis || {};
  const symbols = a.symbols || [];
  const themes = a.themes || [];
  const interpretations = a.possible_interpretations || [];
  const questions = a.questions_to_reflect || [];

  return (
    <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-violet-100">
        <div className="flex justify-between items-center p-6 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center mr-3">
              <Moon className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Dream Analysis</h2>
              <p className="text-gray-600 text-sm">
                Possible meanings and symbols — interpretation is personal and subjective
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {a.summary && (
            <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
              <p className="text-gray-800 italic">&ldquo;{a.summary}&rdquo;</p>
            </div>
          )}

          {a.emotional_tone && (
            <div>
              <h3 className="text-sm font-medium text-violet-700 uppercase tracking-wide mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                Emotional tone
              </h3>
              <p className="text-gray-700">{a.emotional_tone}</p>
            </div>
          )}

          {themes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-violet-700 uppercase tracking-wide mb-2">
                Themes
              </h3>
              <div className="flex flex-wrap gap-2">
                {themes.map((theme, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-violet-100 text-violet-800 rounded-full text-sm"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {symbols.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-violet-700 uppercase tracking-wide mb-3">
                Symbols & possible meanings
              </h3>
              <div className="space-y-3">
                {symbols.map((s, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="font-medium text-gray-900 mb-1">{s.symbol}</div>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5">
                      {(s.possible_meanings || []).map((m, j) => (
                        <li key={j}>{m}</li>
                      ))}
                    </ul>
                    {s.context_note && (
                      <p className="text-xs text-gray-500 mt-2 italic">{s.context_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {interpretations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-violet-700 uppercase tracking-wide mb-3">
                Possible interpretations
              </h3>
              <div className="space-y-3">
                {interpretations.map((interp, i) => (
                  <div key={i} className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                    <div className="font-medium text-indigo-900 mb-1">{interp.angle}</div>
                    <p className="text-sm text-gray-700">{interp.interpretation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-violet-700 uppercase tracking-wide mb-3 flex items-center">
                <HelpCircle className="w-4 h-4 mr-2" />
                Questions to reflect on
              </h3>
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-violet-500 mr-2">•</span>
                    <span className="text-gray-700">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!a.summary && symbols.length === 0 && themes.length === 0 && (
            <div className="text-center py-8">
              <Moon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No analysis yet</h3>
              <p className="text-gray-600">Analyze a dream to see possible meanings.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DreamAnalysisModal;
