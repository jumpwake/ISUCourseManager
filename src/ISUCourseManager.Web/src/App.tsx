import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import styles from './App.module.css';

function App() {
  const isPanelOpen = false;
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main />
        <RightPanel hidden={!isPanelOpen} />
      </div>
    </DesktopOnlyGate>
  );
}

export default App;
