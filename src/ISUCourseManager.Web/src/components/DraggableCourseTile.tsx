import { useDraggable } from '@dnd-kit/core';
import type { StudentCoursePlanTile } from '../data/types.ts';
import { CourseTile } from './CourseTile.tsx';

type Props = {
  tile: StudentCoursePlanTile;
  onClick?: () => void;
  selected?: boolean;
  flagged?: boolean;
};

export function DraggableCourseTile({ tile, onClick, selected, flagged }: Props) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `${tile.classId}-${tile.academicTerm}`,
    data: { tile },
  });
  return (
    <CourseTile
      tile={tile}
      onClick={onClick}
      selected={selected}
      flagged={flagged}
      draggable={{ setNodeRef, attributes, listeners, isDragging }}
    />
  );
}
