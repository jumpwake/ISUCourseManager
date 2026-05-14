import type { PlanTile } from '../data/types.ts';
import { MainHeader } from './MainHeader.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

type Props = {
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function Main({ onTileClick, selectedClassId }: Props) {
  return (
    <main className={styles.main}>
      <MainHeader />
      <PlanView onTileClick={onTileClick} selectedClassId={selectedClassId} />
    </main>
  );
}
