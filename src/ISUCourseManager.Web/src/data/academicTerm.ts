export function academicTermToLabel(term: number): string {
  const academicYear = Math.floor(term / 100);
  const season = term % 100;
  if (season === 2) return `Fall ${academicYear - 1}`;
  if (season === 4) return `Spring ${academicYear}`;
  return `Term ${term}`;
}

export function flowSemToAcademicTerm(semIdx: number, catalogStartYear: number): number {
  const academicYear = catalogStartYear + Math.ceil(semIdx / 2);
  const season = semIdx % 2 === 1 ? 2 : 4;
  return academicYear * 100 + season;
}
