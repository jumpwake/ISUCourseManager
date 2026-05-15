import type { PlanRow, PlanTile } from '../data/types.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

type Props = {
  rows: PlanRow[];
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function PlanView({ rows, onTileClick, selectedClassId }: Props) {
  return (
    <div className={styles.view}>
      {rows.map((row) => (
        <SemRow
          key={row.semIdx}
          row={row}
          onTileClick={onTileClick}
          selectedClassId={selectedClassId}
        />
      ))}
    </div>
  );
}
