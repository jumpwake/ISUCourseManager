import { AiButton } from './AiButton.tsx';
import styles from './TopBar.module.css';

type Props = {
  isPanelOpen: boolean;
  onTogglePanel: () => void;
};

export function TopBar({ isPanelOpen, onTogglePanel }: Props) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        📘 ISU<span className={styles.accent}>CourseManager</span>
      </div>
      <AiButton label="Ask AI" />
      <button
        type="button"
        className={styles.debugToggle}
        onClick={onTogglePanel}
        aria-label="Toggle right panel (debug)"
      >
        {isPanelOpen ? '[panel ✓]' : '[panel]'}
      </button>
      <div className={styles.student}>
        <span>Hi, Luke</span>
        <div className={styles.avatar}>LB</div>
      </div>
    </header>
  );
}
