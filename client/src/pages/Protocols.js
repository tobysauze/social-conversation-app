import React from 'react';
import { CheckCircle2, ClipboardList, Users, Heart, Brain, Activity, Moon } from 'lucide-react';

const protocolGroups = [
  {
    title: 'Social Anxiety Reset',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    whenToUse: 'Before events, first 10 minutes in a group, or when avoidance thoughts spike.',
    steps: [
      'Run 2 physiological sighs, then 60 seconds of slow exhale breathing.',
      'Set one tiny social mission: ask one question and hold eye contact for one sentence.',
      'Use attention redirection: name 3 things you can see and 2 sounds you can hear.',
      'Rate anxiety from 1-10 before and after. Log what helped.'
    ],
    cadence: 'Use 3-5 times per week until pre-event anxiety drops by ~30%.'
  },
  {
    title: 'VO2 Max Builder',
    icon: Activity,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    whenToUse: '2 sessions weekly on non-consecutive days.',
    steps: [
      'Warm up 10 minutes at easy pace.',
      'Complete 4 rounds: 4 minutes hard (Zone 4-5), 3 minutes easy recovery.',
      'Cool down 8-10 minutes.',
      'Track distance or watts on hard intervals and aim for gradual progression.'
    ],
    cadence: 'Run for 6-8 weeks, then deload one week.'
  },
  {
    title: 'Stress Crash Recovery',
    icon: Heart,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    whenToUse: 'After a hard day, conflict, or overstimulation.',
    steps: [
      'Take a 10-minute walk with no phone.',
      'Hydrate and eat a protein + fiber snack.',
      'Do a 5-minute brain dump: what happened, what mattered, what can wait.',
      'Choose one smallest useful next action and complete it in 15 minutes.'
    ],
    cadence: 'Use same-day whenever stress feels sticky.'
  },
  {
    title: 'Sleep Protection Protocol',
    icon: Moon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    whenToUse: 'Nightly, especially during busy or high-stress weeks.',
    steps: [
      'Set a screens-off alarm 60 minutes before bed.',
      'Lower lights and keep room cool/dark.',
      'If mind is racing, write tomorrow top 3 priorities on paper.',
      'No caffeine after lunch and no hard training within 2 hours of bedtime.'
    ],
    cadence: 'Target 5+ nights per week for consistency.'
  },
  {
    title: 'Focus Sprint Protocol',
    icon: Brain,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    whenToUse: 'When procrastinating or mentally scattered.',
    steps: [
      'Pick one outcome only (not a list).',
      'Set a 25-minute timer, phone in another room.',
      'Work in full-screen mode with one tab/tool only.',
      'Take a 5-minute reset break and decide if you run another sprint.'
    ],
    cadence: 'Use 1-3 sprints per work block.'
  }
];

const Protocols = () => {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <ClipboardList className="w-8 h-8 text-primary-600 mr-3" />
          Protocols
        </h1>
        <p className="text-gray-600 mt-2">
          Repeatable playbooks for common challenges. Start simple, run the protocol, then review what worked.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {protocolGroups.map((protocol) => {
          const Icon = protocol.icon;
          return (
            <section key={protocol.title} className="card">
              <div className="flex items-center mb-4">
                <div className={`p-2 rounded-lg mr-3 ${protocol.bgColor}`}>
                  <Icon className={`w-5 h-5 ${protocol.color}`} />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{protocol.title}</h2>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                <span className="font-medium text-gray-800">When to use:</span> {protocol.whenToUse}
              </p>

              <ul className="space-y-2 mb-4">
                {protocol.steps.map((step) => (
                  <li key={step} className="flex items-start text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-primary-600 mt-0.5 mr-2 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>

              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">Cadence:</span> {protocol.cadence}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default Protocols;
