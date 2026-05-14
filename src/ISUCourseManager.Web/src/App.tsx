import { useState } from 'react';
import type { PlanTile, StudentCoursePlanTile } from './data/types.ts';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { ActionMenu } from './components/ActionMenu.tsx';
import styles from './App.module.css';

function App() {
  const [selectedTile, setSelectedTile] = useState<StudentCoursePlanTile | null>(null);

  const isPanelOpen = selectedTile !== null;
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  const handleTileClick = (tile: PlanTile) => {
    if (tile.kind !== 'studentCourse') return;
    if (selectedTile?.classId === tile.classId) {
      setSelectedTile(null);
    } else {
      setSelectedTile(tile);
    }
  };

  const handleClose = () => setSelectedTile(null);

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main
          onTileClick={handleTileClick}
          selectedClassId={selectedTile?.classId ?? null}
        />
        {selectedTile && (
          <RightPanel accent="action">
            <ActionMenu tile={selectedTile} onClose={handleClose} />
          </RightPanel>
        )}
      </div>
    </DesktopOnlyGate>
  );
}

export default App;
