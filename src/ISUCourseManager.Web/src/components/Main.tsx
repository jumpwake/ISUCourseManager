import type { PlanRow, PlanTile } from '../data/types.ts';
import type { PlanValidation } from '../data/validation.ts';
import { MainHeader } from './MainHeader.tsx';
import { ValidationBanner } from './ValidationBanner.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

type Props = {
  rows: PlanRow[];
  validation: PlanValidation;
  flaggedKeys: ReadonlySet<string>;
  onTileClick?: (tile: PlanTile) => void;
  selectedKey?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function Main({
  rows,
  validation,
  flaggedKeys,
  onTileClick,
  selectedKey,
  onAddClass,
}: Props) {
  return (
    <main className={styles.main}>
      <MainHeader />
      <ValidationBanner validation={validation} />
      <PlanView
        rows={rows}
        flaggedKeys={flaggedKeys}
        onTileClick={onTileClick}
        selectedKey={selectedKey}
        onAddClass={onAddClass}
      />
    </main>
  );
}
