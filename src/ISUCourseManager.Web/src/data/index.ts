import type { PlanRow } from './types.ts';
import { flow } from './flow.ts';
import { studentCourses } from './student.ts';
import { catalogById } from './catalog.ts';
import { buildOverlay } from './overlay.ts';

export const PLAN: ReadonlyArray<PlanRow> = buildOverlay(flow, studentCourses, catalogById);
