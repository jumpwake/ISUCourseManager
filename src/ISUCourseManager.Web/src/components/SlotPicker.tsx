import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Course, ElectiveSlotType, UnfilledTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { catalogById } from '../data/catalog.ts';
import styles from './SlotPicker.module.css';

type Props = {
  tile: UnfilledTile;
  onClose: () => void;
  onAskAi?: () => void;
};

const CATALOG_RESULT_CAP = 20;
const CATALOG_DEFAULT_COUNT = 8;

export function SlotPicker({ tile, onClose, onAskAi }: Props) {
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length > 0;

  const catalogResults: Course[] = isSearching
    ? filterCatalog(trimmed)
    : Array.from(catalogById.values()).slice(0, CATALOG_DEFAULT_COUNT);

  const catalogBadge = isSearching
    ? `${catalogResults.length} match${catalogResults.length === 1 ? '' : 'es'}`
    : undefined;

  const ctx = contextLine(tile);

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
        {onAskAi !== undefined && (
          <button
            type="button"
            className={styles.askAiButton}
            onClick={onAskAi}
          >
            <span className={styles.askAiSparkle}>✦</span>
            Ask AI for help
          </button>
        )}

        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search catalog…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search catalog"
        />

        <Section title="Pull from a later semester">
          <p className={styles.emptyMessage}>No pull-forward candidates yet.</p>
        </Section>

        <Section title="Add a new course from the catalog" badge={catalogBadge}>
          {catalogResults.length > 0 ? (
            catalogResults.map((course) => (
              <button key={course.classId} type="button" className={styles.card}>
                <span className={styles.cardContent}>
                  <span className={styles.cardName}>{course.code}</span>
                  <span className={styles.cardMeta}>
                    {course.name} · {course.credits}cr · {course.department}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className={styles.emptyMessage}>
              No courses match "{query.trim()}".
            </p>
          )}
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

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title}
        {badge !== undefined && <span className={styles.sectionBadge}>{badge}</span>}
      </h3>
      {children}
    </div>
  );
}

function filterCatalog(query: string): Course[] {
  const matches: Course[] = [];
  for (const course of catalogById.values()) {
    if (matchesQuery(course, query)) {
      matches.push(course);
      if (matches.length >= CATALOG_RESULT_CAP) break;
    }
  }
  return matches;
}

function matchesQuery(course: Course, q: string): boolean {
  return (
    course.classId.toLowerCase().includes(q) ||
    course.code.toLowerCase().includes(q) ||
    course.name.toLowerCase().includes(q) ||
    course.department.toLowerCase().includes(q)
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
