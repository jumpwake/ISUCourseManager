import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './DesktopOnlyGate.module.css';

type Props = {
  children: ReactNode;
};

const QUERY = '(min-width: 768px)';

export function DesktopOnlyGate({ children }: Props) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!isDesktop) {
    return (
      <div className={styles.gate}>
        <div className={styles.message}>
          <h1>Desktop only</h1>
          <p>Mobile coming soon.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
