import type { ElectiveSlotType, PlanTile, StudentCourseStatus } from '../data/types.ts';
import type { useDraggable } from '@dnd-kit/core';
import styles from './CourseTile.module.css';

type DraggableBindings = Pick<
  ReturnType<typeof useDraggable>,
  'setNodeRef' | 'attributes' | 'listeners' | 'isDragging'
>;

type Props = {
  tile: PlanTile;
  onClick?: () => void;
  selected?: boolean;
  draggable?: DraggableBindings;
  flagged?: boolean;
};

export function CourseTile({ tile, onClick, selected = false, draggable, flagged = false }: Props) {
  if (tile.kind === 'electiveSlot') {
    const className = `${styles.tile} ${styles.electiveEmpty}`;
    const inner = (
      <>
        {electiveLabel(tile.slotType)}
        <small>{tile.requiredCredits}cr</small>
      </>
    );
    return onClick ? (
      <button type="button" className={className} onClick={onClick}>{inner}</button>
    ) : (
      <span className={className}>{inner}</span>
    );
  }

  if (tile.kind === 'unfilledDegreeSlot') {
    const className = `${styles.tile} ${styles.planned} ${styles[tile.dept]}`;
    const inner = (
      <>
        {tile.code}
        <small>{tile.credits}cr</small>
      </>
    );
    return onClick ? (
      <button type="button" className={className} onClick={onClick}>{inner}</button>
    ) : (
      <span className={className}>{inner}</span>
    );
  }

  // studentCourse — always render as <button>
  const selectedClass = selected ? ` ${styles.selected}` : '';

  if (tile.status === 'Completed' && !tile.grade) {
    return (
      <button
        type="button"
        className={`${styles.tile} ${styles.gradePending}${selectedClass}`}
        onClick={onClick}
      >
        {tile.code}
        <small><i>grade pending</i></small>
      </button>
    );
  }

  const statusClass = statusToClass(tile.status);
  // Department tint applies only to Planned tiles (scanning future courses by
  // dept aids planning). Completed / InProgress / Failed show their status
  // color so a status change is visible.
  const deptClass = tile.status === 'Planned' ? ` ${styles[tile.dept]}` : '';
  const subtitle =
    tile.status === 'Completed' ? `${tile.grade} · ${tile.credits}cr` : `${tile.credits}cr`;
  const draggingClass = draggable?.isDragging ? ` ${styles.dragging}` : '';
  return (
    <button
      type="button"
      ref={draggable?.setNodeRef}
      className={`${styles.tile} ${styles[statusClass]}${deptClass}${selectedClass}${draggingClass}`}
      onClick={onClick}
      {...draggable?.attributes}
      {...draggable?.listeners}
    >
      {flagged && <span className={styles.flagBadge} aria-label="Plan issue">⚠</span>}
      {tile.code}
      <small>{subtitle}</small>
    </button>
  );
}

function statusToClass(status: StudentCourseStatus): string {
  switch (status) {
    case 'Completed':
      return 'completed';
    case 'InProgress':
      return 'inprogress';
    case 'Planned':
      return 'planned';
    case 'Failed':
      return 'failed';
    case 'Withdrawn':
      return 'planned';
  }
}

function electiveLabel(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd':
      return 'Gen Ed';
    case 'ElectiveMath':
      return 'Math Elec';
    case 'ElectiveTech':
      return 'Tech Elec';
    case 'ElectiveCybE':
      return 'CybE Elec';
    case 'ElectiveCprE':
      return 'CprE Elec';
  }
}
