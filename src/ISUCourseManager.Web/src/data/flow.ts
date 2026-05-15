import type { DegreeFlow, ElectiveSlotType, FlowSlot } from './types.ts';
import flowRaw from './seed/flow-cybe-2025-26.example.json';

type RawSlot = {
  semester: number;
  slotType: string;
  classId?: string;
  requiredCredits?: number;
  displayOrder: number;
};

function parseSlot(s: RawSlot): FlowSlot {
  if (s.slotType === 'DegreeClass') {
    if (!s.classId) {
      throw new Error(`DegreeClass slot missing classId at semester ${s.semester}`);
    }
    return {
      kind: 'degreeClass',
      semester: s.semester,
      classId: s.classId,
      displayOrder: s.displayOrder,
    };
  }
  return {
    kind: 'elective',
    semester: s.semester,
    slotType: s.slotType as ElectiveSlotType,
    requiredCredits: s.requiredCredits ?? 0,
    displayOrder: s.displayOrder,
  };
}

const slots: FlowSlot[] = (flowRaw.slots as RawSlot[]).map(parseSlot);
const catalogStartYear = parseInt(flowRaw.catalogYear.slice(0, 4), 10);

export const flow: DegreeFlow = {
  code: flowRaw.code,
  catalogYear: flowRaw.catalogYear,
  slots,
  catalogStartYear,
  totalCreditsRequired: flowRaw.totalCreditsRequired,
};
