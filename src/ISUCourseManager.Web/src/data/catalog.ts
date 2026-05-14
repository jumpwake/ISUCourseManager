import type { Course } from './types.ts';
import catalogRaw from './seed/isu-catalog.json';

type RawCatalogCourse = {
  classId: string;
  code: string;
  name: string;
  credits: number;
  department: string;
};

const courses: Course[] = (catalogRaw.courses as RawCatalogCourse[]).map((c) => ({
  classId: c.classId,
  code: c.code,
  name: c.name,
  credits: c.credits,
  department: c.department,
}));

export const catalogById: ReadonlyMap<string, Course> = new Map(
  courses.map((c) => [c.classId, c]),
);
