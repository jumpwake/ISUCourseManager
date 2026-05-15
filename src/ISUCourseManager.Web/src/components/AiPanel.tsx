import { useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AiMessage,
  AiSuggestion,
  ElectiveSlotType,
  UnfilledTile,
} from '../data/types.ts';
import { useAi } from '../data/useAi.ts';
import styles from './AiPanel.module.css';

type Props = {
  tile: UnfilledTile;
  onClose: () => void;
};

export function AiPanel({ tile, onClose }: Props) {
  const { messages, suggestions, quickAsks, send } = useAi({ kind: 'slot', tile });
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) return;
    send(trimmed);
    setInputValue('');
  };

  const [initialMessage, ...conversationTurns] = messages;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.aiCapsule}>AI</span>
          <span className={styles.title}>Help filling this slot</span>
          <span className={styles.scopeChip}>{scopeLabel(tile)}</span>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close AI panel"
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {initialMessage && <MessageBlock msg={initialMessage} />}

        <div className={styles.suggestionList}>
          {suggestions.map((sg) => (
            <SuggestionCard key={sg.id} sg={sg} />
          ))}
        </div>

        {conversationTurns.map((msg, i) => (
          <MessageBlock key={i} msg={msg} />
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Ask about this slot…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            aria-label="Ask AI about this slot"
          />
          <button type="button" className={styles.sendBtn} onClick={handleSend}>
            Ask
          </button>
        </div>
        <div className={styles.quickAsks}>
          {quickAsks.map((qa) => (
            <button
              key={qa}
              type="button"
              className={styles.quickAsk}
              onClick={() => send(qa)}
            >
              {qa}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBlock({ msg }: { msg: AiMessage }) {
  if (msg.role === 'ai') {
    return (
      <div className={styles.msg}>
        {msg.lead !== undefined && <div className={styles.lead}>{msg.lead}</div>}
        <div>{renderMessageContent(msg.content)}</div>
      </div>
    );
  }
  return (
    <div className={styles.msg}>
      <div className={`${styles.lead} ${styles.userLead}`}>You</div>
      <div>{msg.content}</div>
    </div>
  );
}

function SuggestionCard({ sg }: { sg: AiSuggestion }) {
  const className = sg.isRecommended
    ? `${styles.suggestion} ${styles.recommended}`
    : styles.suggestion;
  return (
    <div className={className}>
      <div className={styles.sgHead}>
        <span className={styles.sgName}>
          {sg.isRecommended ? `✦ ${sg.name}` : sg.name}
        </span>
        <span className={styles.sgMeta}>{sg.meta}</span>
      </div>
      <div className={styles.sgRationale}>{sg.rationale}</div>
      <div className={styles.sgActions}>
        <button type="button" className={styles.sgPrimary}>
          {sg.primaryActionLabel}
        </button>
        <button type="button" className={styles.sgGhost}>
          Why?
        </button>
      </div>
    </div>
  );
}

function renderMessageContent(text: string): ReactNode {
  const parts = text.split('**');
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
  );
}

function scopeLabel(tile: UnfilledTile): string {
  if (tile.kind === 'electiveSlot') {
    return `Sem ${tile.semIdx} · ${electiveLabel(tile.slotType)} · ${tile.requiredCredits}cr`;
  }
  return `Sem ${tile.semIdx} · ${tile.code}`;
}

function electiveLabel(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd':
      return 'Gen Ed';
    case 'ElectiveMath':
      return 'Math Elec';
    case 'ElectiveTech':
      return 'Tech Elec';
    case 'ElectiveCybE':
      return 'CybE Elec';
    case 'ElectiveCprE':
      return 'CprE Elec';
  }
}
