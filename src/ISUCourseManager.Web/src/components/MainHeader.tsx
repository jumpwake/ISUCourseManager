import { AiButton } from './AiButton.tsx';
import styles from './MainHeader.module.css';

export function MainHeader() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Plan view</h1>
      <AiButton label="Analyze flow" size="sm" />
      <div className={styles.meta}>grad: —</div>
    </header>
  );
}
