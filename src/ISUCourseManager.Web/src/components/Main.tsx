import { MainHeader } from './MainHeader.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

export function Main() {
  return (
    <main className={styles.main}>
      <MainHeader />
      <PlanView />
    </main>
  );
}
