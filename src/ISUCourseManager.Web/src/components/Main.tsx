import { MainHeader } from './MainHeader.tsx';
import styles from './Main.module.css';

export function Main() {
  return (
    <main className={styles.main}>
      <MainHeader />
      <div className={styles.body} />
    </main>
  );
}
