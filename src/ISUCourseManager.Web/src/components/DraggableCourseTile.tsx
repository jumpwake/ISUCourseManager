import { useDraggable } from '@dnd-kit/core';
import type { StudentCoursePlanTile } from '../data/types.ts';
import { CourseTile } from './CourseTile.tsx';

type Props = {
  tile: StudentCoursePlanTile;
  onClick?: () => void;
  selected?: boolean;
};

export function DraggableCourseTile({ tile, onClick, selected }: Props) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `${tile.classId}-${tile.academicTerm}`,
    data: { tile },
  });
  return (
    <CourseTile
      tile={tile}
      onClick={onClick}
      selected={selected}
      draggable={{ setNodeRef, attributes, listeners, isDragging }}
    />
  );
}
