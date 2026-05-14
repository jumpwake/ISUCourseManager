import styles from './RightPanel.module.css';

type Props = {
  hidden?: boolean;
};

export function RightPanel({ hidden = false }: Props) {
  const className = hidden ? `${styles.panel} ${styles.hidden}` : styles.panel;
  return <aside className={className} />;
}
