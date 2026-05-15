import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
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
import { CourseTile } from './components/CourseTile.tsx';
import styles from './App.module.css';

type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile }
  | { kind: 'aiPanel'; tile: UnfilledTile }
  | { kind: 'addClass'; semIdx: number; academicTerm: number }
  | { kind: 'substitute'; tile: StudentCoursePlanTile };

function App() {
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>(seedStudentCourses);
  const [selected, setSelected] = useState<SelectedPanel | null>(null);
  const [activeDrag, setActiveDrag] = useState<StudentCoursePlanTile | null>(null);

  const rows = useMemo(
    () => buildOverlay(flow, studentCourses, catalogById),
    [studentCourses],
  );

  const semesters = rows.map((r) => ({ semIdx: r.semIdx, academicTerm: r.academicTerm }));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
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

  const applyAction = (action: CourseAction, classId: string, academicTerm: number) => {
    const isTarget = (sc: StudentCourse) =>
      sc.courseId === classId && sc.academicTerm === academicTerm;
    if (action === 'remove') {
      setStudentCourses((prev) => prev.filter((sc) => !isTarget(sc)));
    } else {
      const status: StudentCourseStatus =
        action === 'markCompleted'
          ? 'Completed'
          : action === 'markInProgress'
            ? 'InProgress'
            : 'Failed';
      setStudentCourses((prev) =>
        prev.map((sc) => (isTarget(sc) ? { ...sc, status } : sc)),
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

  const moveCourse = (classId: string, fromTerm: number, toTerm: number) => {
    setStudentCourses((prev) =>
      prev.map((sc) =>
        sc.courseId === classId && sc.academicTerm === fromTerm
          ? { ...sc, academicTerm: toTerm }
          : sc,
      ),
    );
    setSelected(null);
  };

  const substituteCourse = (oldClassId: string, term: number, newClassId: string) => {
    setStudentCourses((prev) => [
      ...prev.filter((sc) => !(sc.courseId === oldClassId && sc.academicTerm === term)),
      { courseId: newClassId, academicTerm: term, status: 'Planned', grade: null },
    ]);
    setSelected(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const tile: StudentCoursePlanTile | undefined = event.active.data.current?.tile;
    setActiveDrag(tile ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const tile: StudentCoursePlanTile | undefined = event.active.data.current?.tile;
    const toTerm: number | undefined = event.over?.data.current?.academicTerm;
    if (tile && toTerm !== undefined && toTerm !== tile.academicTerm) {
      moveCourse(tile.classId, tile.academicTerm, toTerm);
    }
  };

  const selectedClassId =
    selected?.kind === 'actionMenu' ? selected.tile.classId : null;

  const panelAccent = selected?.kind === 'aiPanel' ? 'ai' : 'action';

  return (
    <DesktopOnlyGate>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
                  semesters={semesters}
                  onClose={handleClose}
                  onAction={(action) =>
                    applyAction(action, selected.tile.classId, selected.tile.academicTerm)
                  }
                  onMove={(toTerm) =>
                    moveCourse(selected.tile.classId, selected.tile.academicTerm, toTerm)
                  }
                  onSubstitute={() => setSelected({ kind: 'substitute', tile: selected.tile })}
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
              {selected.kind === 'substitute' && (
                <SlotPicker
                  target={{
                    kind: 'substitute',
                    classId: selected.tile.classId,
                    semIdx: selected.tile.semIdx,
                    academicTerm: selected.tile.academicTerm,
                  }}
                  onClose={handleClose}
                  onPickCourse={(newClassId) =>
                    substituteCourse(
                      selected.tile.classId,
                      selected.tile.academicTerm,
                      newClassId,
                    )
                  }
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
        <DragOverlay>
          {activeDrag ? <CourseTile tile={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>
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
