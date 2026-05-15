import { useState } from 'react';
import type {
  PlanTile,
  StudentCoursePlanTile,
  UnfilledTile,
} from './data/types.ts';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { ActionMenu } from './components/ActionMenu.tsx';
import { SlotPicker } from './components/SlotPicker.tsx';
import { AiPanel } from './components/AiPanel.tsx';
import styles from './App.module.css';

type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile }
  | { kind: 'aiPanel'; tile: UnfilledTile };

function App() {
  const [selected, setSelected] = useState<SelectedPanel | null>(null);

  const isPanelOpen = selected !== null;
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  const handleTileClick = (tile: PlanTile) => {
    if (tile.kind === 'studentCourse') {
      if (selected?.kind === 'actionMenu' && selected.tile.classId === tile.classId) {
        setSelected(null);
      } else {
        setSelected({ kind: 'actionMenu', tile });
      }
      return;
    }
    if (selected?.kind === 'slotPicker' && isSameUnfilledTile(selected.tile, tile)) {
      setSelected(null);
    } else {
      setSelected({ kind: 'slotPicker', tile });
    }
  };

  const handleAskAi = (tile: UnfilledTile) => {
    setSelected({ kind: 'aiPanel', tile });
  };

  const handleClose = () => setSelected(null);

  const selectedClassId =
    selected?.kind === 'actionMenu' ? selected.tile.classId : null;

  const panelAccent = selected?.kind === 'aiPanel' ? 'ai' : 'action';

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main onTileClick={handleTileClick} selectedClassId={selectedClassId} />
        {selected && (
          <RightPanel accent={panelAccent}>
            {selected.kind === 'actionMenu' && (
              <ActionMenu tile={selected.tile} onClose={handleClose} />
            )}
            {selected.kind === 'slotPicker' && (
              <SlotPicker
                tile={selected.tile}
                onClose={handleClose}
                onAskAi={() => handleAskAi(selected.tile)}
              />
            )}
            {selected.kind === 'aiPanel' && (
              <AiPanel tile={selected.tile} onClose={handleClose} />
            )}
          </RightPanel>
        )}
      </div>
    </DesktopOnlyGate>
  );
}

function isSameUnfilledTile(a: UnfilledTile, b: UnfilledTile): boolean {
  if (a.kind === 'unfilledDegreeSlot' && b.kind === 'unfilledDegreeSlot') {
    return a.classId === b.classId && a.semIdx === b.semIdx;
  }
  if (a.kind === 'electiveSlot' && b.kind === 'electiveSlot') {
    return a.slotType === b.slotType && a.semIdx === b.semIdx;
  }
  return false;
}

export default App;
