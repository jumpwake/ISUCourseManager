import type { ReactNode } from 'react';
import type { ElectiveSlotType, UnfilledTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { catalogById } from '../data/catalog.ts';
import styles from './SlotPicker.module.css';

type Props = {
  tile: UnfilledTile;
  onClose: () => void;
};

export function SlotPicker({ tile, onClose }: Props) {
  const ctx = contextLine(tile);
  const catalogPreview = Array.from(catalogById.values()).slice(0, 8);

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.breadcrumb}>
            Sem {tile.semIdx} · {academicTermToLabel(tile.academicTerm)}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close slot picker"
          >
            ×
          </button>
        </div>
        <h2 className={styles.title}>Fill this slot</h2>
        <div className={styles.ctx}>{ctx}</div>
      </div>

      <div className={styles.body}>
        <Section title="Pull from a later semester">
          <p className={styles.emptyMessage}>No pull-forward candidates yet.</p>
        </Section>

        <Section title="Add a new course from the catalog">
          {catalogPreview.map((course) => (
            <button key={course.classId} type="button" className={styles.card}>
              <span className={styles.cardContent}>
                <span className={styles.cardName}>{course.code}</span>
                <span className={styles.cardMeta}>
                  {course.name} · {course.credits}cr · {course.department}
                </span>
              </span>
            </button>
          ))}
        </Section>

        <Section title="Leave this slot empty">
          <button type="button" className={`${styles.card} ${styles.muted}`}>
            <span className={styles.cardContent}>
              <span className={styles.cardName}>Leave this slot empty</span>
              <span className={styles.cardMeta}>
                Sem {tile.semIdx} will fall short of its credit target.
              </span>
            </span>
          </button>
        </Section>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.applyBtn} disabled>
          Apply selection
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

function contextLine(tile: UnfilledTile): string {
  if (tile.kind === 'unfilledDegreeSlot') {
    return `Originally: ${tile.code} · ${tile.name}`;
  }
  return `Originally: ${electiveLabel(tile.slotType)} (${tile.requiredCredits}cr)`;
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
