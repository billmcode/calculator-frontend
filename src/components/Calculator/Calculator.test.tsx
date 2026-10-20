// Presentational tests for Calculator: render with mock callback props (no
// hook, no API mocking) and assert each control invokes the right callback,
// plus that error/expression/display render from props as given.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculator from './Calculator';
import type { CalculatorProps } from './Calculator';

function renderCalculator(overrides: Partial<CalculatorProps> = {}) {
  const props: CalculatorProps = {
    display: '0',
    expression: '',
    error: '',
    onDigit: vi.fn(),
    onDecimal: vi.fn(),
    onToggleSign: vi.fn(),
    onPercent: vi.fn(),
    onOperator: vi.fn(),
    onCalculate: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<Calculator {...props} />);
  return props;
}

describe('Calculator - digit buttons', () => {
  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])('invokes onDigit("%s") when clicked', async (digit) => {
    const user = userEvent.setup();
    const props = renderCalculator();

    await user.click(screen.getByRole('button', { name: digit }));

    expect(props.onDigit).toHaveBeenCalledWith(digit);
    expect(props.onDigit).toHaveBeenCalledTimes(1);
  });
});

describe('Calculator - other controls', () => {
  it('invokes onDecimal when "." is clicked', async () => {
    const user = userEvent.setup();
    const props = renderCalculator();

    await user.click(screen.getByRole('button', { name: '.' }));

    expect(props.onDecimal).toHaveBeenCalledTimes(1);
  });

  it('invokes onToggleSign when "+/-" is clicked', async () => {
    const user = userEvent.setup();
    const props = renderCalculator();

    await user.click(screen.getByRole('button', { name: '+/-' }));

    expect(props.onToggleSign).toHaveBeenCalledTimes(1);
  });

  it('invokes onPercent when "%" is clicked', async () => {
    const user = userEvent.setup();
    const props = renderCalculator();

    await user.click(screen.getByRole('button', { name: '%' }));

    expect(props.onPercent).toHaveBeenCalledTimes(1);
  });

  it('invokes onCalculate when "=" is clicked', async () => {
    const user = userEvent.setup();
    const props = renderCalculator();

    await user.click(screen.getByRole('button', { name: '=' }));

    expect(props.onCalculate).toHaveBeenCalledTimes(1);
  });

  it('invokes onClear when "C" is clicked', async () => {
    const user = userEvent.setup();
    const props = renderCalculator();

    await user.click(screen.getByRole('button', { name: 'C' }));

    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});

describe('Calculator - operator buttons', () => {
  it.each([
    ['÷', '/'],
    ['×', '*'],
    ['−', '-'],
    ['+', '+'],
  ])('invokes onOperator("%s") when the %s button is clicked', async (label, op) => {
    const user = userEvent.setup();
    const props = renderCalculator();

    await user.click(screen.getByRole('button', { name: label }));

    expect(props.onOperator).toHaveBeenCalledWith(op);
    expect(props.onOperator).toHaveBeenCalledTimes(1);
  });
});

describe('Calculator - error message', () => {
  it('renders the error message when error is non-empty', () => {
    renderCalculator({ error: 'Cannot divide by zero' });

    expect(screen.getByText('Cannot divide by zero')).toBeInTheDocument();
  });

  it('does not render an error message when error is empty', () => {
    renderCalculator({ error: '' });

    expect(screen.queryByText('Cannot divide by zero')).not.toBeInTheDocument();
  });
});

describe('Calculator - expression and display', () => {
  it('renders the expression and display text from props', () => {
    renderCalculator({ expression: '5 +', display: '12' });

    expect(screen.getByText('5 +')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
