import type { ReactNode } from 'react';
import styles from './RightPanel.module.css';

type Props = {
  accent?: 'ai' | 'action';
  children?: ReactNode;
};

export function RightPanel({ accent = 'ai', children }: Props) {
  const accentClass = accent === 'action' ? styles.accentAction : styles.accentAi;
  return <aside className={`${styles.panel} ${accentClass}`}>{children}</aside>;
}
