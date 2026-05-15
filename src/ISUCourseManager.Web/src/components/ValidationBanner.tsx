import type { PlanValidation } from '../data/validation.ts';
import styles from './ValidationBanner.module.css';

type Props = {
  validation: PlanValidation;
};

export function ValidationBanner({ validation }: Props) {
  const { issues, unfilledCount, plannedCredits, requiredCredits } = validation;
  const clean = issues.length === 0;
  const className = clean
    ? `${styles.banner} ${styles.clean}`
    : `${styles.banner} ${styles.hasIssues}`;
  return (
    <div className={className}>
      <span className={styles.stat}>
        {plannedCredits} / {requiredCredits} cr planned
      </span>
      <span className={styles.divider}>·</span>
      <span className={styles.stat}>{unfilledCount} unfilled</span>
      <span className={styles.divider}>·</span>
      <span className={styles.summary}>{clean ? 'Plan looks good' : issueSummary(validation)}</span>
    </div>
  );
}

function issueSummary(validation: PlanValidation): string {
  const overloads = validation.issues.filter((i) => i.kind === 'creditOverload').length;
  const underloads = validation.issues.filter((i) => i.kind === 'creditUnderload').length;
  const termIssues = validation.issues.filter((i) => i.kind === 'termUnavailable').length;
  const parts: string[] = [];
  if (overloads > 0) parts.push(`${overloads} semester${overloads === 1 ? '' : 's'} over 18 cr`);
  if (underloads > 0) parts.push(`${underloads} under 12 cr`);
  if (termIssues > 0) {
    parts.push(`${termIssues} course${termIssues === 1 ? '' : 's'} in an unavailable term`);
  }
  return parts.join(' · ');
}
