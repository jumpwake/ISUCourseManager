import type {
  Course,
  DegreeFlow,
  PlanRow,
  PlanTile,
  StudentCourse,
} from './types.ts';
import { flowSemToAcademicTerm } from './academicTerm.ts';
import { departmentToCssClass } from './department.ts';

export function buildOverlay(
  flow: DegreeFlow,
  studentCourses: ReadonlyArray<StudentCourse>,
  catalogById: ReadonlyMap<string, Course>,
): PlanRow[] {
  const enrolledClassIds = new Set(studentCourses.map((sc) => sc.courseId));

  const maxFlowSem = flow.slots.reduce((m, s) => Math.max(m, s.semester), 0);
  const totalSems = Math.max(maxFlowSem, 8);

  const studentByTerm = new Map<number, StudentCourse[]>();
  for (const sc of studentCourses) {
    const list = studentByTerm.get(sc.academicTerm) ?? [];
    list.push(sc);
    studentByTerm.set(sc.academicTerm, list);
  }

  const rows: PlanRow[] = [];
  for (let semIdx = 1; semIdx <= totalSems; semIdx++) {
    const academicTerm = flowSemToAcademicTerm(semIdx, flow.catalogStartYear);
    const tiles: PlanTile[] = [];

    const studentTilesThisTerm = studentByTerm.get(academicTerm) ?? [];
    for (const sc of studentTilesThisTerm) {
      const course = catalogById.get(sc.courseId);
      if (!course) continue;
      tiles.push({
        kind: 'studentCourse',
        classId: course.classId,
        code: course.code,
        name: course.name,
        credits: course.credits,
        dept: departmentToCssClass(course.department),
        deptDisplay: course.department,
        status: sc.status,
        grade: sc.grade,
        academicTerm: sc.academicTerm,
        semIdx,
      });
    }

    const slotsThisSem = flow.slots
      .filter((s) => s.semester === semIdx)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    for (const slot of slotsThisSem) {
      if (slot.kind === 'degreeClass') {
        if (enrolledClassIds.has(slot.classId)) continue;
        const course = catalogById.get(slot.classId);
        if (!course) continue;
        tiles.push({
          kind: 'unfilledDegreeSlot',
          classId: course.classId,
          code: course.code,
          name: course.name,
          credits: course.credits,
          dept: departmentToCssClass(course.department),
          academicTerm,
          semIdx,
        });
      } else {
        tiles.push({
          kind: 'electiveSlot',
          slotType: slot.slotType,
          requiredCredits: slot.requiredCredits,
          academicTerm,
          semIdx,
        });
      }
    }

    const totalCredits = tiles.reduce((sum, t) => {
      if (t.kind === 'studentCourse' || t.kind === 'unfilledDegreeSlot') return sum + t.credits;
      return sum + t.requiredCredits;
    }, 0);

    const allCompleted =
      tiles.length > 0 &&
      tiles.every((t) => t.kind === 'studentCourse' && t.status === 'Completed');

    rows.push({ semIdx, academicTerm, tiles, totalCredits, allCompleted });
  }

  return rows;
}
