import { http, HttpResponse } from 'msw';
import type {
  AiAskRequest,
  AiAskResponse,
  AiScope,
  AiSuggestion,
  ElectiveSlotType,
} from '../data/types.ts';

export const handlers = [
  http.post('/api/v1/ai/ask', async ({ request }) => {
    const body = (await request.json()) as AiAskRequest;
    return HttpResponse.json(buildResponse(body));
  }),
];

function buildResponse(req: AiAskRequest): AiAskResponse {
  if (req.message === null) {
    return {
      messages: [{ role: 'ai', lead: 'Reading your plan', content: initialContent(req.scope) }],
      suggestions: SUGGESTIONS,
      quickAsks: QUICK_ASKS,
    };
  }
  return {
    messages: [{ role: 'ai', content: CANNED_REPLY }],
    suggestions: [],
    quickAsks: [],
  };
}

function initialContent(scope: AiScope): string {
  const tile = scope.tile;
  if (tile.kind === 'electiveSlot') {
    return `Looking at your plan, this **${electiveLabelLong(tile.slotType)}** slot in Sem ${tile.semIdx} is open. Below are a few candidates that fit your major and term workload. I can also pull alternatives — ask me anything.`;
  }
  return `This is your **${tile.code} · ${tile.name}** slot. I can suggest alternatives, help you decide whether to defer it, or compare what other CybE students did. Ask me anything.`;
}

const SUGGESTIONS: AiSuggestion[] = [
  {
    id: 'psych-2300',
    name: 'PSYCH 2300 · Intro to Psychology',
    meta: '3 cr · F/S/Su · no prereq',
    rationale:
      'Most-picked Gen Ed among CybE majors (89% of cohort). Cognitive-bias coverage is useful for security work; light reading load.',
    isRecommended: true,
    primaryActionLabel: 'Add to slot',
  },
  {
    id: 'phil-2300',
    name: 'PHIL 2300 · Moral Theory & Practice',
    meta: '3 cr · F/S · no prereq',
    rationale:
      'Pairs well with CYBE 2340 (Ethics in Security) — gives you philosophical grounding ahead of time. Discussion-heavy, no exams.',
    primaryActionLabel: 'Add to slot',
  },
  {
    id: 'hist-2010',
    name: 'HIST 2010 · Western Civ I',
    meta: '3 cr · F/S · no prereq',
    rationale:
      'Counts toward both Gen Ed and U.S. Cultures. Lecture-based; manageable workload.',
    primaryActionLabel: 'Add to slot',
  },
];

const QUICK_ASKS: string[] = [
  'What pairs with this term?',
  'Lighter workload options',
  'Compare alternatives',
];

const CANNED_REPLY =
  'Got it — let me pull a few angles for you. (Real AI replies land in a later step; this is a canned MSW response so you can exercise the conversation surface.)';

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
