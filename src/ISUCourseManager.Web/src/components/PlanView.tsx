import type { PlanTile } from '../data/types.ts';
import { PLAN } from '../data/index.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

type Props = {
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function PlanView({ onTileClick, selectedClassId }: Props) {
  return (
    <div className={styles.view}>
      {PLAN.map((row) => (
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
