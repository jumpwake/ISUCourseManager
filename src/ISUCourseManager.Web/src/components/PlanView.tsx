import { PLAN } from '../data/index.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

export function PlanView() {
  return (
    <div className={styles.view}>
      {PLAN.map((row) => (
        <SemRow key={row.semIdx} row={row} />
      ))}
    </div>
  );
}
