import type { Course, PlanRow } from './types.ts';
import { academicTermToSeason } from './academicTerm.ts';

export type PlanIssue =
  | { kind: 'creditOverload'; semIdx: number; credits: number }
  | { kind: 'creditUnderload'; semIdx: number; credits: number }
  | {
      kind: 'termUnavailable';
      classId: string;
      code: string;
      semIdx: number;
      academicTerm: number;
      season: string;
      offered: string[];
    };

export type PlanValidation = {
  issues: PlanIssue[];
  unfilledCount: number;
  plannedCredits: number;
  requiredCredits: number;
};

const OVERLOAD_CREDITS = 18;
const UNDERLOAD_CREDITS = 12;

export function validatePlan(
  rows: PlanRow[],
  requiredCredits: number,
  catalogById: ReadonlyMap<string, Course>,
): PlanValidation {
  const issues: PlanIssue[] = [];
  let unfilledCount = 0;
  let plannedCredits = 0;

  for (const row of rows) {
    if (!row.allCompleted && row.totalCredits > OVERLOAD_CREDITS) {
      issues.push({ kind: 'creditOverload', semIdx: row.semIdx, credits: row.totalCredits });
    }
    if (!row.allCompleted && row.totalCredits > 0 && row.totalCredits < UNDERLOAD_CREDITS) {
      issues.push({ kind: 'creditUnderload', semIdx: row.semIdx, credits: row.totalCredits });
    }
    for (const tile of row.tiles) {
      if (tile.kind === 'unfilledDegreeSlot' || tile.kind === 'electiveSlot') {
        unfilledCount += 1;
        continue;
      }
      if (
        tile.status === 'Completed' ||
        tile.status === 'InProgress' ||
        tile.status === 'Planned'
      ) {
        plannedCredits += tile.credits;
      }
      if (tile.status !== 'Completed') {
        const course = catalogById.get(tile.classId);
        if (course && course.typicallyOffered.length > 0) {
          const season = academicTermToSeason(tile.academicTerm);
          if (!course.typicallyOffered.includes(season)) {
            issues.push({
              kind: 'termUnavailable',
              classId: tile.classId,
              code: tile.code,
              semIdx: tile.semIdx,
              academicTerm: tile.academicTerm,
              season,
              offered: course.typicallyOffered,
            });
          }
        }
      }
    }
  }

  return { issues, unfilledCount, plannedCredits, requiredCredits };
}
