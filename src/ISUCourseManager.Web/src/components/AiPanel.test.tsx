import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiPanel } from './AiPanel.tsx';
import type { UnfilledTile } from '../data/types.ts';

const tile: UnfilledTile = {
  kind: 'unfilledDegreeSlot',
  classId: 'COMS-2270',
  code: 'Com S 2270',
  name: 'Intro Program',
  credits: 4,
  dept: 'coms',
  academicTerm: 202602,
  semIdx: 3,
};

describe('AiPanel', () => {
  it('loads the scoped initial message from the AI endpoint', async () => {
    render(<AiPanel scope={{ kind: 'slot', tile }} onClose={() => {}} onBack={() => {}} />);
    expect(
      await screen.findByText(/compare what other CybE students did/i),
    ).toBeInTheDocument();
  });

  it('sends a question and shows the AI reply', async () => {
    const user = userEvent.setup();
    render(<AiPanel scope={{ kind: 'slot', tile }} onClose={() => {}} onBack={() => {}} />);
    await screen.findByText(/compare what other CybE students did/i);

    const input = screen.getByLabelText('Ask AI about this slot');
    await user.type(input, 'What pairs with this?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText('You')).toBeInTheDocument();
    expect(await screen.findByText(/let me pull a few angles/i)).toBeInTheDocument();
  });

  it('loads a semester-scoped initial message', async () => {
    render(
      <AiPanel
        scope={{ kind: 'semester', semIdx: 4, academicTerm: 202704 }}
        onClose={() => {}}
        onBack={() => {}}
      />,
    );
    expect(
      await screen.findByText(/tell me what you're after/i),
    ).toBeInTheDocument();
  });
});
