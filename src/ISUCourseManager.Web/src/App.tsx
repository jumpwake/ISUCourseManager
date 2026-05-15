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
  AiScope,
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
import { validatePlan } from './data/validation.ts';
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
  | { kind: 'aiPanel'; scope: AiScope }
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

  const semesters = useMemo(
    () => rows.map((r) => ({ semIdx: r.semIdx, academicTerm: r.academicTerm })),
    [rows],
  );

  const validation = useMemo(
    () => validatePlan(rows, flow.totalCreditsRequired, catalogById),
    [rows],
  );

  const flaggedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const issue of validation.issues) {
      if (issue.kind === 'termUnavailable') {
        keys.add(`${issue.classId}-${issue.academicTerm}`);
      }
    }
    return keys;
  }, [validation]);

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

  const handleAskAi = (scope: AiScope) => {
    setSelected({ kind: 'aiPanel', scope });
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
    setStudentCourses((prev) => {
      // No duplicate course within one semester (cross-semester retakes are fine).
      if (prev.some((sc) => sc.courseId === classId && sc.academicTerm === academicTerm)) {
        return prev;
      }
      return [
        ...prev,
        { courseId: classId, academicTerm, status: 'Planned', grade: null },
      ];
    });
    setSelected(null);
  };

  const moveCourse = (classId: string, fromTerm: number, toTerm: number) => {
    setStudentCourses((prev) => {
      // Don't move into a semester that already holds this course.
      if (prev.some((sc) => sc.courseId === classId && sc.academicTerm === toTerm)) {
        return prev;
      }
      return prev.map((sc) =>
        sc.courseId === classId && sc.academicTerm === fromTerm
          ? { ...sc, academicTerm: toTerm }
          : sc,
      );
    });
    setSelected(null);
  };

  const substituteCourse = (oldClassId: string, term: number, newClassId: string) => {
    setStudentCourses((prev) => {
      const withoutOld = prev.filter(
        (sc) => !(sc.courseId === oldClassId && sc.academicTerm === term),
      );
      // Skip the add if the replacement is already in this semester.
      if (withoutOld.some((sc) => sc.courseId === newClassId && sc.academicTerm === term)) {
        return withoutOld;
      }
      return [
        ...withoutOld,
        { courseId: newClassId, academicTerm: term, status: 'Planned', grade: null },
      ];
    });
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

  const selectedKey =
    selected?.kind === 'actionMenu'
      ? `${selected.tile.classId}-${selected.tile.academicTerm}`
      : null;

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
            validation={validation}
            flaggedKeys={flaggedKeys}
            onTileClick={handleTileClick}
            selectedKey={selectedKey}
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
                  onAskAi={() => handleAskAi({ kind: 'slot', tile: selected.tile })}
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
                  onAskAi={() =>
                    handleAskAi({
                      kind: 'semester',
                      semIdx: selected.semIdx,
                      academicTerm: selected.academicTerm,
                    })
                  }
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
                  scope={selected.scope}
                  onClose={handleClose}
                  onBack={() =>
                    setSelected(
                      selected.scope.kind === 'slot'
                        ? { kind: 'slotPicker', tile: selected.scope.tile }
                        : {
                            kind: 'addClass',
                            semIdx: selected.scope.semIdx,
                            academicTerm: selected.scope.academicTerm,
                          },
                    )
                  }
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
