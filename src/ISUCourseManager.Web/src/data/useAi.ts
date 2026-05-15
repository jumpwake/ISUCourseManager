import { useState } from 'react';
import type {
  AiMessage,
  AiScope,
  AiSuggestion,
  ElectiveSlotType,
} from './types.ts';

export function useAi(scope: AiScope): {
  messages: AiMessage[];
  suggestions: AiSuggestion[];
  quickAsks: string[];
  send: (userText: string) => void;
} {
  const [messages, setMessages] = useState<AiMessage[]>(() => initialMessages(scope));

  const send = (userText: string) => {
    const trimmed = userText.trim();
    if (trimmed.length === 0) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: trimmed },
      { role: 'ai', content: cannedReply() },
    ]);
  };

  return {
    messages,
    suggestions: suggestionsForScope(scope),
    quickAsks: quickAsksForScope(scope),
    send,
  };
}

function initialMessages(scope: AiScope): AiMessage[] {
  const tile = scope.tile;
  if (tile.kind === 'electiveSlot') {
    return [
      {
        role: 'ai',
        lead: 'Reading your plan',
        content: `Looking at your plan, this **${electiveLabelLong(tile.slotType)}** slot in Sem ${tile.semIdx} is open. Below are a few candidates that fit your major and term workload. I can also pull alternatives — ask me anything.`,
      },
    ];
  }
  return [
    {
      role: 'ai',
      lead: 'Reading your plan',
      content: `This is your **${tile.code} · ${tile.name}** slot. I can suggest alternatives, help you decide whether to defer it, or compare what other CybE students did. Ask me anything.`,
    },
  ];
}

function suggestionsForScope(_scope: AiScope): AiSuggestion[] {
  return [
    {
      id: 'psych-2300',
      name: 'PSYCH 2300 · Intro to Psychology',
      meta: '3 cr · F/S/Su · no prereq',
      rationale: 'Most-picked Gen Ed among CybE majors (89% of cohort). Cognitive-bias coverage is useful for security work; light reading load.',
      isRecommended: true,
      primaryActionLabel: 'Add to slot',
    },
    {
      id: 'phil-2300',
      name: 'PHIL 2300 · Moral Theory & Practice',
      meta: '3 cr · F/S · no prereq',
      rationale: 'Pairs well with CYBE 2340 (Ethics in Security) — gives you philosophical grounding ahead of time. Discussion-heavy, no exams.',
      primaryActionLabel: 'Add to slot',
    },
    {
      id: 'hist-2010',
      name: 'HIST 2010 · Western Civ I',
      meta: '3 cr · F/S · no prereq',
      rationale: 'Counts toward both Gen Ed and U.S. Cultures. Lecture-based; manageable workload.',
      primaryActionLabel: 'Add to slot',
    },
  ];
}

function quickAsksForScope(_scope: AiScope): string[] {
  return [
    'What pairs with this term?',
    'Lighter workload options',
    'Compare alternatives',
  ];
}

function cannedReply(): string {
  return 'Got it — let me pull a few angles for you. (Real AI replies land in a later step; this is a stubbed response so you can exercise the conversation surface.)';
}

function electiveLabelLong(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd':
      return 'Gen Ed Elective';
    case 'ElectiveMath':
      return 'Math Elective';
    case 'ElectiveTech':
      return 'Tech Elective';
    case 'ElectiveCybE':
      return 'CybE Elective';
    case 'ElectiveCprE':
      return 'CprE Elective';
  }
}
