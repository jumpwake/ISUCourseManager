import { AiMark } from './AiMark.tsx';
import styles from './Sidebar.module.css';

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <section className={styles.section}>
        <div className={styles.label}>My degree flows</div>
      </section>
      <section className={styles.section}>
        <div className={styles.label}>
          <span>Insights</span>
          <AiMark />
        </div>
      </section>
    </aside>
  );
}
