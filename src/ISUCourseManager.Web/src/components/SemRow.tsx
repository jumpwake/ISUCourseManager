import type { PlanRow, PlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { CourseTile } from './CourseTile.tsx';
import styles from './SemRow.module.css';

type Props = { row: PlanRow };

export function SemRow({ row }: Props) {
  const creditClass = creditColorClass(row);
  return (
    <div className={styles.row}>
      <div className={styles.label}>
        <span>Sem {row.semIdx}</span>
        <small>{academicTermToLabel(row.academicTerm)}</small>
        <span className={`${styles.credits} ${styles[creditClass]}`}>
          {row.totalCredits} cr
        </span>
      </div>
      {row.tiles.map((tile, i) => (
        <CourseTile key={tileKey(tile, i)} tile={tile} />
      ))}
    </div>
  );
}

function creditColorClass(row: PlanRow): string {
  if (row.allCompleted) return 'creditsDone';
  if (row.totalCredits > 18) return 'creditsOver';
  if (row.totalCredits < 12) return 'creditsUnder';
  return 'creditsNormal';
}

function tileKey(tile: PlanTile, index: number): string {
  if (tile.kind === 'electiveSlot') return `elec-${tile.slotType}-${index}`;
  return tile.classId;
}
