import type { ReactNode } from 'react';
import type { StudentCoursePlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import styles from './ActionMenu.module.css';

type Props = {
  tile: StudentCoursePlanTile;
  onClose: () => void;
};

export function ActionMenu({ tile, onClose }: Props) {
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
        <Section title="Update status">
          <ActionCard icon="✓" name="Mark Completed" meta="Set grade" />
          <ActionCard icon="⏵" name="Mark In Progress" meta="Currently enrolled this term" />
          <ActionCard icon="⚠" name="Mark Failed / Cancelled" meta="Will trigger cascade for downstream prereqs" danger />
        </Section>
        <Section title="Reschedule">
          <ActionCard icon="→" name="Move to future term" meta="Pre-req not met / scheduling conflict" />
          <ActionCard icon="←" name="Move to earlier term" meta="Take ahead of recommended schedule" />
        </Section>
        <Section title="Replace">
          <ActionCard icon="⇄" name="Substitute another course" meta="Pick a course that satisfies this slot" />
        </Section>
        <Section title="Remove">
          <ActionCard icon="×" name="Remove from plan" meta="Take the slot back to unfulfilled" danger />
        </Section>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
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
};

function ActionCard({ icon, name, meta, danger = false }: ActionCardProps) {
  const className = danger ? `${styles.card} ${styles.danger}` : styles.card;
  return (
    <button type="button" className={className}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.content}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </button>
  );
}
