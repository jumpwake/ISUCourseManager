import type { PlanRow, PlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { CourseTile } from './CourseTile.tsx';
import styles from './SemRow.module.css';

type Props = {
  row: PlanRow;
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function SemRow({ row, onTileClick, selectedClassId, onAddClass }: Props) {
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
        <CourseTile
          key={tileKey(tile, i)}
          tile={tile}
          onClick={onTileClick ? () => onTileClick(tile) : undefined}
          selected={tile.kind === 'studentCourse' && selectedClassId === tile.classId}
        />
      ))}
      {onAddClass && !row.allCompleted && (
        <button
          type="button"
          className={styles.addClassTile}
          onClick={() => onAddClass(row.semIdx, row.academicTerm)}
        >
          + Add Course
        </button>
      )}
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
