// Presentational tests for History: render with mock props directly, no
// hook and no API mocking involved.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import History from './History';
import { makeCalculationResponse } from '../../test-utils/fixtures';
import { operationSymbol } from '../Calculator/useCalculator';

describe('History - empty state', () => {
  it('renders "No calculations yet." when history is empty', () => {
    render(<History history={[]} operationSymbol={operationSymbol} onDelete={vi.fn()} />);

    expect(screen.getByText('No calculations yet.')).toBeInTheDocument();
  });

  it('does not render the empty message when history has items', () => {
    render(
      <History history={[makeCalculationResponse()]} operationSymbol={operationSymbol} onDelete={vi.fn()} />,
    );

    expect(screen.queryByText('No calculations yet.')).not.toBeInTheDocument();
  });
});

describe('History - populated state', () => {
  it('renders each history item as "a {symbol} b = result" with a delete button', () => {
    const items = [
      makeCalculationResponse({ id: 1, operation: 'add', a: 1, b: 2, result: 3 }),
      makeCalculationResponse({ id: 2, operation: 'mul', a: 4, b: 5, result: 20 }),
    ];

    render(<History history={items} operationSymbol={operationSymbol} onDelete={vi.fn()} />);

    expect(screen.getByText('1 + 2 = 3')).toBeInTheDocument();
    expect(screen.getByText('4 × 5 = 20')).toBeInTheDocument();
    // The delete buttons render "×" as their text content with a "Delete"
    // title/tooltip - query by title rather than accessible name, since the
    // text content (not the title) wins as the accessible name here.
    expect(screen.getAllByTitle('Delete')).toHaveLength(2);
  });
});

describe('History - delete button', () => {
  it('invokes onDelete with the correct id when clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const items = [
      makeCalculationResponse({ id: 1, operation: 'add', a: 1, b: 2, result: 3 }),
      makeCalculationResponse({ id: 2, operation: 'sub', a: 9, b: 4, result: 5 }),
    ];

    render(<History history={items} operationSymbol={operationSymbol} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[1]);

    expect(onDelete).toHaveBeenCalledWith(2);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
