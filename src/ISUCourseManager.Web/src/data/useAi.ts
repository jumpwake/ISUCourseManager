import { useEffect, useState } from 'react';
import type { AiAskRequest, AiAskResponse, AiMessage, AiScope, AiSuggestion } from './types.ts';

type UseAiResult = {
  messages: AiMessage[];
  suggestions: AiSuggestion[];
  quickAsks: string[];
  loading: boolean;
  error: boolean;
  send: (userText: string) => void;
  retry: () => void;
};

async function postAsk(req: AiAskRequest): Promise<AiAskResponse> {
  const res = await fetch('/api/v1/ai/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`AI request failed: ${res.status}`);
  }
  return (await res.json()) as AiAskResponse;
}

export function useAi(scope: AiScope): UseAiResult {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [quickAsks, setQuickAsks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastFailed, setLastFailed] = useState<AiAskRequest | null>(null);

  async function runRequest(req: AiAskRequest): Promise<void> {
    setLoading(true);
    setError(false);
    try {
      const data = await postAsk(req);
      if (req.message === null) {
        setMessages(data.messages);
        setSuggestions(data.suggestions);
        setQuickAsks(data.quickAsks);
      } else {
        setMessages((prev) => [...prev, ...data.messages]);
      }
      setLastFailed(null);
    } catch {
      setError(true);
      setLastFailed(req);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const req: AiAskRequest = { scope, message: null };
    void (async () => {
      await runRequest(req);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(userText: string): void {
    const trimmed = userText.trim();
    if (trimmed.length === 0) return;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    void runRequest({ scope, message: trimmed });
  }

  function retry(): void {
    if (lastFailed !== null) {
      void runRequest(lastFailed);
    }
  }

  return { messages, suggestions, quickAsks, loading, error, send, retry };
}
