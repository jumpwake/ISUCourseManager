import type { PlanRow, PlanTile } from '../data/types.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

type Props = {
  rows: PlanRow[];
  flaggedKeys: ReadonlySet<string>;
  onTileClick?: (tile: PlanTile) => void;
  selectedKey?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function PlanView({
  rows,
  flaggedKeys,
  onTileClick,
  selectedKey,
  onAddClass,
}: Props) {
  return (
    <div className={styles.view}>
      {rows.map((row) => (
        <SemRow
          key={row.semIdx}
          row={row}
          flaggedKeys={flaggedKeys}
          onTileClick={onTileClick}
          selectedKey={selectedKey}
          onAddClass={onAddClass}
        />
      ))}
    </div>
  );
}
