import { useDroppable } from '@dnd-kit/core';
import type { PlanRow, PlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { CourseTile } from './CourseTile.tsx';
import { DraggableCourseTile } from './DraggableCourseTile.tsx';
import styles from './SemRow.module.css';

type Props = {
  row: PlanRow;
  flaggedKeys: ReadonlySet<string>;
  onTileClick?: (tile: PlanTile) => void;
  selectedKey?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function SemRow({ row, flaggedKeys, onTileClick, selectedKey, onAddClass }: Props) {
  const creditClass = creditColorClass(row);
  const { setNodeRef, isOver } = useDroppable({
    id: `sem-${row.academicTerm}`,
    data: { academicTerm: row.academicTerm },
  });
  const rowClassName = isOver ? `${styles.row} ${styles.dropTarget}` : styles.row;
  return (
    <div className={rowClassName} ref={setNodeRef}>
      <div className={styles.label}>
        <span>Sem {row.semIdx}</span>
        <small>{academicTermToLabel(row.academicTerm)}</small>
        <span className={`${styles.credits} ${styles[creditClass]}`}>
          {row.totalCredits} cr
        </span>
      </div>
      {row.tiles.map((tile, i) =>
        tile.kind === 'studentCourse' && tile.status !== 'Completed' ? (
          <DraggableCourseTile
            key={tileKey(tile, i)}
            tile={tile}
            onClick={onTileClick ? () => onTileClick(tile) : undefined}
            selected={selectedKey === `${tile.classId}-${tile.academicTerm}`}
            flagged={flaggedKeys.has(`${tile.classId}-${tile.academicTerm}`)}
          />
        ) : (
          <CourseTile
            key={tileKey(tile, i)}
            tile={tile}
            onClick={onTileClick ? () => onTileClick(tile) : undefined}
            selected={
              tile.kind === 'studentCourse' &&
              selectedKey === `${tile.classId}-${tile.academicTerm}`
            }
          />
        ),
      )}
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
