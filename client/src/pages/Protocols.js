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
import React from 'react';
import { ClipboardList, Gauge, Brain, Moon, Zap, Users } from 'lucide-react';

const protocols = [
  {
    title: 'Social Anxiety: Exposure Ladder',
    icon: Brain,
    objective: 'Lower avoidance and build confidence in everyday social settings.',
    cadence: '3-5x per week',
    steps: [
      'Pick one situation that causes mild anxiety (3-4/10).',
      'Do a 10-minute approach action (say hi, ask one question, stay present).',
      'Rate anxiety before and after; note one thing that went better than expected.',
      'Repeat until anxiety drops, then level up difficulty gradually.'
    ],
    score: 'Weekly score: number of exposures completed + average anxiety drop.'
  },
  {
    title: 'VO2 Max Builder: 4x4 Intervals',
    icon: Gauge,
    objective: 'Increase aerobic power and cardiovascular fitness.',
    cadence: '2 sessions per week (non-consecutive days)',
    steps: [
      'Warm up 10-15 minutes easy.',
      'Do 4 rounds: 4 minutes hard (RPE 8/10), 3 minutes easy recovery.',
      'Cool down 10 minutes easy.',
      'Track average pace, power, or heart rate across rounds.'
    ],
    score: 'Weekly score: consistency + ability to hold output in round 4.'
  },
  {
    title: 'Sleep Reset: Evening Wind-Down',
    icon: Moon,
    objective: 'Improve sleep onset and next-day energy.',
    cadence: 'Nightly',
    steps: [
      'Set a fixed wake-up time and protect it daily.',
      'Start a 45-minute wind-down: dim lights, no phone, low stimulation.',
      'Do 5 minutes of slow breathing (4s inhale, 6s exhale).',
      'If awake for 20+ minutes in bed, get up briefly and read calmly.'
    ],
    score: 'Weekly score: nights with full routine + average morning energy (1-10).'
  },
  {
    title: 'Deep Work Sprint Protocol',
    icon: Zap,
    objective: 'Increase focused output and reduce context switching.',
    cadence: '1-2 times daily',
    steps: [
      'Define one clear outcome for a 50-minute sprint.',
      'Remove distractions (phone away, tabs closed, notifications off).',
      'Work 50 minutes, then take a deliberate 10-minute break.',
      'Log output shipped, not just time spent.'
    ],
    score: 'Weekly score: number of completed sprints and key outcomes delivered.'
  },
  {
    title: 'Conflict Repair Conversation',
    icon: Users,
    objective: 'Repair trust faster after tension or miscommunication.',
    cadence: 'As needed, within 24 hours',
    steps: [
      'Open with shared intent: "I want us to understand each other better."',
      'Use a 2:1 ratio: two minutes listening for every one minute speaking.',
      'Reflect back their point before stating yours.',
      'End with one concrete next step and check-in date.'
    ],
    score: 'Weekly score: unresolved conflicts reduced + quality of follow-through.'
  }
];

const Protocols = () => {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center mb-2">
          <ClipboardList className="w-7 h-7 text-indigo-600 mr-2" />
          Protocols
        </h1>
        <p className="text-gray-600">
          Reusable playbooks for handling common challenges. Start simple, run consistently, and review weekly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {protocols.map((protocol) => {
          const Icon = protocol.icon;
          return (
            <div key={protocol.title} className="card border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{protocol.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">Cadence: {protocol.cadence}</p>
                </div>
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
              </div>

              <p className="text-gray-700 mb-4">{protocol.objective}</p>

              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2 mb-4">
                {protocol.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <div className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700">
                {protocol.score}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Protocols;
