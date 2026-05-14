import type { StudentCourse, StudentCourseStatus } from './types.ts';
import studentRaw from './seed/student-luke.json';

type RawStudentCourse = {
  courseId: string;
  academicTerm: number;
  status: string;
  grade: string;
};

function normalizeStatus(raw: string): StudentCourseStatus {
  if (raw === 'Complete' || raw === 'Completed') return 'Completed';
  if (raw === 'InProgress' || raw === 'In Progress') return 'InProgress';
  if (raw === 'Failed') return 'Failed';
  if (raw === 'Withdrawn') return 'Withdrawn';
  return 'Planned';
}

function normalizeGrade(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const studentCourses: StudentCourse[] = (studentRaw.courses as RawStudentCourse[]).map((c) => ({
  courseId: c.courseId,
  academicTerm: c.academicTerm,
  status: normalizeStatus(c.status),
  grade: normalizeGrade(c.grade),
}));

export const studentName: string = studentRaw.student.displayName;
