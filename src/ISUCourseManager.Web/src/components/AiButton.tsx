import styles from './AiButton.module.css';

type Props = {
  label: string;
  size?: 'sm' | 'md';
};

export function AiButton({ label, size = 'md' }: Props) {
  return (
    <button type="button" className={`${styles.btn} ${styles[size]}`}>
      <span className={styles.sparkle}>✦</span>
      {label}
    </button>
  );
}
