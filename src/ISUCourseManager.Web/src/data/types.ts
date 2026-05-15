export type StudentCourseStatus =
  | 'Planned' | 'InProgress' | 'Completed' | 'Failed' | 'Withdrawn';

export type Course = {
  classId: string;
  code: string;
  name: string;
  credits: number;
  department: string;
};

export type ElectiveSlotType =
  | 'ElectiveGenEd' | 'ElectiveMath' | 'ElectiveTech' | 'ElectiveCybE' | 'ElectiveCprE';

export type FlowSlot =
  | { kind: 'degreeClass'; semester: number; classId: string; displayOrder: number; }
  | { kind: 'elective'; semester: number; slotType: ElectiveSlotType; requiredCredits: number; displayOrder: number; };

export type DegreeFlow = {
  code: string;
  catalogYear: string;
  slots: FlowSlot[];
  catalogStartYear: number;
};

export type StudentCourse = {
  courseId: string;
  academicTerm: number;
  status: StudentCourseStatus;
  grade: string | null;
};

export type PlanTile =
  | {
      kind: 'studentCourse';
      classId: string;
      code: string;
      name: string;
      credits: number;
      dept: string;
      deptDisplay: string;
      status: StudentCourseStatus;
      grade: string | null;
      academicTerm: number;
      semIdx: number;
    }
  | {
      kind: 'unfilledDegreeSlot';
      classId: string;
      code: string;
      name: string;
      credits: number;
      dept: string;
      academicTerm: number;
      semIdx: number;
    }
  | {
      kind: 'electiveSlot';
      slotType: ElectiveSlotType;
      requiredCredits: number;
      academicTerm: number;
      semIdx: number;
    };

export type PlanRow = {
  semIdx: number;
  academicTerm: number;
  tiles: PlanTile[];
  totalCredits: number;
  allCompleted: boolean;
};

export type StudentCoursePlanTile = Extract<PlanTile, { kind: 'studentCourse' }>;
export type UnfilledTile = Extract<PlanTile, { kind: 'unfilledDegreeSlot' | 'electiveSlot' }>;

export type AiMessage =
  | { role: 'ai'; lead?: string; content: string }
  | { role: 'user'; content: string };

export type AiSuggestion = {
  id: string;
  name: string;
  meta: string;
  rationale: string;
  isRecommended?: boolean;
  primaryActionLabel: string;
};

export type AiScope =
  | { kind: 'slot'; tile: UnfilledTile };

export type CourseAction = 'markCompleted' | 'markInProgress' | 'markFailed' | 'remove';

export type SlotPickerTarget =
  | { kind: 'slot'; tile: UnfilledTile }
  | { kind: 'addToSem'; semIdx: number; academicTerm: number };
