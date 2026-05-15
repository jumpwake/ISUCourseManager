import type { PlanRow, PlanTile } from '../data/types.ts';
import { MainHeader } from './MainHeader.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

type Props = {
  rows: PlanRow[];
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function Main({ rows, onTileClick, selectedClassId, onAddClass }: Props) {
  return (
    <main className={styles.main}>
      <MainHeader />
      <PlanView
        rows={rows}
        onTileClick={onTileClick}
        selectedClassId={selectedClassId}
        onAddClass={onAddClass}
      />
    </main>
  );
}
