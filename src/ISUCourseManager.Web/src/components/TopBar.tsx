import { AiButton } from './AiButton.tsx';
import styles from './TopBar.module.css';

export function TopBar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        📘 ISU<span className={styles.accent}>CourseManager</span>
      </div>
      <AiButton label="Ask AI" />
      <div className={styles.student}>
        <span>Hi, Luke</span>
        <div className={styles.avatar}>LB</div>
      </div>
    </header>
  );
}
