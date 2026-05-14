const KNOWN_DEPTS: ReadonlySet<string> = new Set([
  'math',
  'cpre',
  'cybe',
  'coms',
  'engl',
  'gened',
]);

export function departmentToCssClass(department: string): string {
  const normalized = department.toLowerCase().replace(/\s+/g, '');
  return KNOWN_DEPTS.has(normalized) ? normalized : 'gened';
}
