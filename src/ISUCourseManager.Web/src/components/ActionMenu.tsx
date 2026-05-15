import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CourseAction, StudentCoursePlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import styles from './ActionMenu.module.css';

type Semester = { semIdx: number; academicTerm: number };

type Props = {
  tile: StudentCoursePlanTile;
  semesters: Semester[];
  onClose: () => void;
  onAction: (action: CourseAction) => void;
  onMove: (toAcademicTerm: number) => void;
  onSubstitute: () => void;
};

export function ActionMenu({
  tile,
  semesters,
  onClose,
  onAction,
  onMove,
  onSubstitute,
}: Props) {
  const [moveMode, setMoveMode] = useState<'future' | 'earlier' | null>(null);

  const laterSemesters = semesters.filter((s) => s.semIdx > tile.semIdx);
  const earlierSemesters = semesters.filter((s) => s.semIdx < tile.semIdx);

  return (
    <div className={styles.menu}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.breadcrumb}>
            Sem {tile.semIdx} · {academicTermToLabel(tile.academicTerm)}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close action menu"
          >
            ×
          </button>
        </div>
        <h2 className={styles.title}>
          {tile.classId} · {tile.name}
        </h2>
        <div className={styles.ctx}>
          Department: {tile.deptDisplay} · {tile.credits} credits
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaPill}>Status: {tile.status}</span>
          {tile.grade != null && (
            <span className={styles.metaPill}>Grade: {tile.grade}</span>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {tile.status === 'Completed' ? (
          <p className={styles.emptyMessage}>
            This course is complete — no actions available.
          </p>
        ) : moveMode !== null ? (
          <MoveView
            moveMode={moveMode}
            destinations={moveMode === 'future' ? laterSemesters : earlierSemesters}
            onBack={() => setMoveMode(null)}
            onMove={onMove}
          />
        ) : (
          <>
            <Section title="Update status">
              <ActionCard
                icon="✓"
                name="Mark Completed"
                meta="Set grade"
                onClick={() => onAction('markCompleted')}
              />
              <ActionCard
                icon="⏵"
                name="Mark In Progress"
                meta="Currently enrolled this term"
                onClick={() => onAction('markInProgress')}
              />
              <ActionCard
                icon="⚠"
                name="Mark Failed / Cancelled"
                meta="Will trigger cascade for downstream prereqs"
                danger
                onClick={() => onAction('markFailed')}
              />
            </Section>
            <Section title="Reschedule">
              <ActionCard
                icon="→"
                name="Move to future term"
                meta="Pre-req not met / scheduling conflict"
                disabled={laterSemesters.length === 0}
                onClick={() => setMoveMode('future')}
              />
              <ActionCard
                icon="←"
                name="Move to earlier term"
                meta="Take ahead of recommended schedule"
                disabled={earlierSemesters.length === 0}
                onClick={() => setMoveMode('earlier')}
              />
            </Section>
            <Section title="Replace">
              <ActionCard
                icon="⇄"
                name="Substitute another course"
                meta="Pick a course that satisfies this slot"
                onClick={onSubstitute}
              />
            </Section>
            <Section title="Remove">
              <ActionCard
                icon="×"
                name="Remove from plan"
                meta="Take the slot back to unfulfilled"
                danger
                onClick={() => onAction('remove')}
              />
            </Section>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function MoveView({
  moveMode,
  destinations,
  onBack,
  onMove,
}: {
  moveMode: 'future' | 'earlier';
  destinations: Semester[];
  onBack: () => void;
  onMove: (toAcademicTerm: number) => void;
}) {
  return (
    <div className={styles.section}>
      <button type="button" className={styles.backLink} onClick={onBack}>
        ← Back
      </button>
      <h3 className={styles.sectionTitle}>
        {moveMode === 'future'
          ? 'Move to a later semester'
          : 'Move to an earlier semester'}
      </h3>
      {destinations.map((sem) => (
        <button
          key={sem.semIdx}
          type="button"
          className={styles.card}
          onClick={() => onMove(sem.academicTerm)}
        >
          <span className={styles.icon}>{moveMode === 'future' ? '→' : '←'}</span>
          <span className={styles.content}>
            <span className={styles.name}>Sem {sem.semIdx}</span>
            <span className={styles.meta}>{academicTermToLabel(sem.academicTerm)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

type ActionCardProps = {
  icon: string;
  name: string;
  meta: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

function ActionCard({
  icon,
  name,
  meta,
  danger = false,
  disabled = false,
  onClick,
}: ActionCardProps) {
  const className = danger ? `${styles.card} ${styles.danger}` : styles.card;
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.content}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </button>
  );
}
