import { useMemo, useState } from 'react';
import type {
  CourseAction,
  PlanTile,
  StudentCourse,
  StudentCoursePlanTile,
  StudentCourseStatus,
  UnfilledTile,
} from './data/types.ts';
import { studentCourses as seedStudentCourses } from './data/student.ts';
import { flow } from './data/flow.ts';
import { catalogById } from './data/catalog.ts';
import { buildOverlay } from './data/overlay.ts';
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
  | { kind: 'aiPanel'; tile: UnfilledTile }
  | { kind: 'addClass'; semIdx: number; academicTerm: number };

function App() {
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>(seedStudentCourses);
  const [selected, setSelected] = useState<SelectedPanel | null>(null);

  const rows = useMemo(
    () => buildOverlay(flow, studentCourses, catalogById),
    [studentCourses],
  );

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

  const handleAddClass = (semIdx: number, academicTerm: number) => {
    setSelected({ kind: 'addClass', semIdx, academicTerm });
  };

  const handleClose = () => setSelected(null);

  const applyAction = (action: CourseAction, classId: string) => {
    if (action === 'remove') {
      setStudentCourses((prev) => prev.filter((sc) => sc.courseId !== classId));
    } else {
      const status: StudentCourseStatus =
        action === 'markCompleted'
          ? 'Completed'
          : action === 'markInProgress'
            ? 'InProgress'
            : 'Failed';
      setStudentCourses((prev) =>
        prev.map((sc) => (sc.courseId === classId ? { ...sc, status } : sc)),
      );
    }
    setSelected(null);
  };

  const addCourse = (classId: string, academicTerm: number) => {
    setStudentCourses((prev) => [
      ...prev,
      { courseId: classId, academicTerm, status: 'Planned', grade: null },
    ]);
    setSelected(null);
  };

  const selectedClassId =
    selected?.kind === 'actionMenu' ? selected.tile.classId : null;

  const panelAccent = selected?.kind === 'aiPanel' ? 'ai' : 'action';

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main
          rows={rows}
          onTileClick={handleTileClick}
          selectedClassId={selectedClassId}
          onAddClass={handleAddClass}
        />
        {selected && (
          <RightPanel accent={panelAccent}>
            {selected.kind === 'actionMenu' && (
              <ActionMenu
                tile={selected.tile}
                onClose={handleClose}
                onAction={(action) => applyAction(action, selected.tile.classId)}
              />
            )}
            {selected.kind === 'slotPicker' && (
              <SlotPicker
                target={{ kind: 'slot', tile: selected.tile }}
                onClose={handleClose}
                onPickCourse={(classId) => addCourse(classId, selected.tile.academicTerm)}
                onAskAi={() => handleAskAi(selected.tile)}
              />
            )}
            {selected.kind === 'addClass' && (
              <SlotPicker
                target={{
                  kind: 'addToSem',
                  semIdx: selected.semIdx,
                  academicTerm: selected.academicTerm,
                }}
                onClose={handleClose}
                onPickCourse={(classId) => addCourse(classId, selected.academicTerm)}
              />
            )}
            {selected.kind === 'aiPanel' && (
              <AiPanel
                tile={selected.tile}
                onClose={handleClose}
                onBack={() => setSelected({ kind: 'slotPicker', tile: selected.tile })}
              />
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
