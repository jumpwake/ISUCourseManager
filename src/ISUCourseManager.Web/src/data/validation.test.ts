import { describe, it, expect } from 'vitest';
import { validatePlan } from './validation.ts';
import type { Course, PlanRow, PlanTile, StudentCourseStatus } from './types.ts';

const FALL = 202602; // term % 100 === 2
const SPRING = 202604; // term % 100 === 4

function student(
  classId: string,
  credits: number,
  status: StudentCourseStatus,
  academicTerm: number,
  semIdx: number,
): PlanTile {
  return {
    kind: 'studentCourse',
    classId,
    code: classId,
    name: classId,
    credits,
    dept: 'coms',
    deptDisplay: 'Com S',
    status,
    grade: null,
    academicTerm,
    semIdx,
  };
}

function unfilled(semIdx: number, academicTerm: number): PlanTile {
  return {
    kind: 'unfilledDegreeSlot',
    classId: 'X-1',
    code: 'X 1',
    name: 'X',
    credits: 3,
    dept: 'coms',
    academicTerm,
    semIdx,
  };
}

function row(
  spec: { semIdx: number; tiles: PlanTile[]; totalCredits: number; academicTerm?: number; allCompleted?: boolean },
): PlanRow {
  return {
    semIdx: spec.semIdx,
    academicTerm: spec.academicTerm ?? FALL,
    tiles: spec.tiles,
    totalCredits: spec.totalCredits,
    allCompleted: spec.allCompleted ?? false,
  };
}

const catalog: ReadonlyMap<string, Course> = new Map<string, Course>([
  ['FALLONLY-1', { classId: 'FALLONLY-1', code: 'FALLONLY-1', name: 'Fall Only', credits: 3, department: 'Com S', typicallyOffered: ['Fall'] }],
  ['BOTH-1', { classId: 'BOTH-1', code: 'BOTH-1', name: 'Both', credits: 3, department: 'Com S', typicallyOffered: ['Fall', 'Spring'] }],
  ['NODATA-1', { classId: 'NODATA-1', code: 'NODATA-1', name: 'No Data', credits: 3, department: 'Com S', typicallyOffered: [] }],
]);

describe('validatePlan', () => {
  it('flags a semester over 18 credits', () => {
    const rows = [row({ semIdx: 3, tiles: [student('A', 20, 'Planned', FALL, 3)], totalCredits: 20 })];
    const result = validatePlan(rows, 125, catalog);
    expect(result.issues).toContainEqual({ kind: 'creditOverload', semIdx: 3, credits: 20 });
  });

  it('flags a non-empty semester under 12 credits', () => {
    const rows = [row({ semIdx: 3, tiles: [student('A', 9, 'Planned', FALL, 3)], totalCredits: 9 })];
    const result = validatePlan(rows, 125, catalog);
    expect(result.issues).toContainEqual({ kind: 'creditUnderload', semIdx: 3, credits: 9 });
  });

  it('does not flag credit load on all-completed or 0-credit rows', () => {
    const rows = [
      row({ semIdx: 1, tiles: [student('A', 20, 'Completed', FALL, 1)], totalCredits: 20, allCompleted: true }),
      row({ semIdx: 8, tiles: [], totalCredits: 0 }),
    ];
    const result = validatePlan(rows, 125, catalog);
    expect(result.issues).toEqual([]);
  });

  it('flags a non-Completed course offered only in another season', () => {
    const rows = [
      row({ semIdx: 4, academicTerm: SPRING, tiles: [student('FALLONLY-1', 15, 'Planned', SPRING, 4)], totalCredits: 15 }),
    ];
    const result = validatePlan(rows, 125, catalog);
    expect(result.issues).toContainEqual({
      kind: 'termUnavailable',
      classId: 'FALLONLY-1',
      code: 'FALLONLY-1',
      semIdx: 4,
      academicTerm: SPRING,
      season: 'Spring',
      offered: ['Fall'],
    });
  });

  it('does not flag term availability when offered that season, no data, or completed', () => {
    const rows = [
      row({ semIdx: 4, academicTerm: SPRING, tiles: [student('BOTH-1', 15, 'Planned', SPRING, 4)], totalCredits: 15 }),
      row({ semIdx: 5, academicTerm: FALL, tiles: [student('NODATA-1', 15, 'Planned', FALL, 5)], totalCredits: 15 }),
      row({ semIdx: 6, academicTerm: SPRING, tiles: [student('FALLONLY-1', 15, 'Completed', SPRING, 6)], totalCredits: 15, allCompleted: true }),
    ];
    const result = validatePlan(rows, 125, catalog);
    expect(result.issues.filter((i) => i.kind === 'termUnavailable')).toEqual([]);
  });

  it('counts unfilled requirements and planned credits, excluding failed courses', () => {
    const rows = [
      row({
        semIdx: 3,
        tiles: [
          student('A', 3, 'Completed', FALL, 3),
          student('B', 3, 'InProgress', FALL, 3),
          student('C', 3, 'Planned', FALL, 3),
          student('D', 3, 'Failed', FALL, 3),
          unfilled(3, FALL),
        ],
        totalCredits: 15,
      }),
      row({ semIdx: 4, academicTerm: SPRING, tiles: [unfilled(4, SPRING)], totalCredits: 0 }),
    ];
    const result = validatePlan(rows, 125, catalog);
    expect(result.unfilledCount).toBe(2);
    expect(result.plannedCredits).toBe(9);
    expect(result.requiredCredits).toBe(125);
  });

  it('returns no issues for a clean plan', () => {
    const rows = [
      row({ semIdx: 3, tiles: [student('BOTH-1', 15, 'Planned', FALL, 3)], totalCredits: 15 }),
    ];
    const result = validatePlan(rows, 125, catalog);
    expect(result.issues).toEqual([]);
  });
});
