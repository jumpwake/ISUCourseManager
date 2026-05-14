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
      status: StudentCourseStatus;
      grade: string | null;
    }
  | {
      kind: 'unfilledDegreeSlot';
      classId: string;
      code: string;
      name: string;
      credits: number;
      dept: string;
    }
  | {
      kind: 'electiveSlot';
      slotType: ElectiveSlotType;
      requiredCredits: number;
    };

export type PlanRow = {
  semIdx: number;
  academicTerm: number;
  tiles: PlanTile[];
  totalCredits: number;
  allCompleted: boolean;
};
