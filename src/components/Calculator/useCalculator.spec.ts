// Tests for the calculator engine hook, in isolation from any rendered
// component. The backend API module is mocked so these tests exercise only
// useCalculator's own state machine (digit entry, operator handling,
// history refresh, error propagation).
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCalculator } from './useCalculator';
import * as calculatorApi from '../../api/calculatorApi';
import type { CalculationResponse } from '../../types/calculator';

vi.mock('../../api/calculatorApi');

const mockedApi = vi.mocked(calculatorApi);

function makeHistoryItem(overrides: Partial<CalculationResponse> = {}): CalculationResponse {
  return {
    id: 1,
    operation: 'add',
    a: 1,
    b: 2,
    result: 3,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: history loads to an empty array unless a test overrides it.
  mockedApi.getHistory.mockResolvedValue([]);
});

describe('useCalculator - initial mount', () => {
  it('loads history once on mount', async () => {
    const items = [makeHistoryItem({ id: 1 }), makeHistoryItem({ id: 2 })];
    mockedApi.getHistory.mockResolvedValue(items);

    const { result } = renderHook(() => useCalculator());

    await waitFor(() => expect(result.current.history).toEqual(items));
    expect(mockedApi.getHistory).toHaveBeenCalledTimes(1);
  });
});

describe('useCalculator - digit entry', () => {
  it('replaces the display when it is "0"', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));

    expect(result.current.display).toBe('5');
  });

  it('appends digits when the display is not "0"', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.inputDigit('2'));

    expect(result.current.display).toBe('52');
  });

  it('replaces the display and clears waitingForOperand after a result', async () => {
    mockedApi.add.mockResolvedValue({ result: 8 });
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.setOperator('+'));
    act(() => result.current.inputDigit('3'));
    await act(async () => {
      result.current.calculate();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.display).toBe('8'));

    // Next digit should replace (not append to) the result, proving
    // waitingForOperand was set and then cleared by this digit entry.
    act(() => result.current.inputDigit('9'));
    expect(result.current.display).toBe('9');

    // And a subsequent digit now appends, confirming the waiting flag was
    // actually cleared rather than display just happening to be replaced.
    act(() => result.current.inputDigit('1'));
    expect(result.current.display).toBe('91');
  });
});

describe('useCalculator - decimal entry', () => {
  it('appends a single decimal point', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.inputDecimal());

    expect(result.current.display).toBe('5.');
  });

  it('does not duplicate the decimal point', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.inputDecimal());
    act(() => result.current.inputDigit('2'));
    act(() => result.current.inputDecimal());

    expect(result.current.display).toBe('5.2');
  });

  it('resets to "0." when waiting for an operand', async () => {
    mockedApi.add.mockResolvedValue({ result: 8 });
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.setOperator('+'));
    act(() => result.current.inputDigit('3'));
    await act(async () => {
      result.current.calculate();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.display).toBe('8'));

    act(() => result.current.inputDecimal());

    expect(result.current.display).toBe('0.');
  });
});

describe('useCalculator - sign toggle and percent', () => {
  it('toggleSign negates the current display value', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.toggleSign());
    expect(result.current.display).toBe('-5');

    act(() => result.current.toggleSign());
    expect(result.current.display).toBe('5');
  });

  it('inputPercent divides the current display value by 100', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.inputDigit('0'));
    act(() => result.current.inputPercent());

    expect(result.current.display).toBe('0.5');
  });
});

describe('useCalculator - clear', () => {
  it('resets display, expression, error, and internal operand/operator state', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.setOperator('+'));
    act(() => result.current.inputDigit('3'));

    act(() => result.current.clear());

    expect(result.current.display).toBe('0');
    expect(result.current.expression).toBe('');
    expect(result.current.error).toBe('');

    // calculate() is a no-op once cleared: no pending operator/operand means
    // no backend call should ever be issued.
    act(() => result.current.calculate());
    expect(mockedApi.add).not.toHaveBeenCalled();
    expect(mockedApi.subtract).not.toHaveBeenCalled();
    expect(mockedApi.multiply).not.toHaveBeenCalled();
    expect(mockedApi.divide).not.toHaveBeenCalled();
  });
});

describe('useCalculator - operator chaining with intermediate backend call', () => {
  it('issues an intermediate backend call for the first operator when a new one is set before "="', async () => {
    mockedApi.add.mockResolvedValue({ result: 8 });
    mockedApi.subtract.mockResolvedValue({ result: 6 });

    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.setOperator('+')); // operandA = 5, operator = '+'
    act(() => result.current.inputDigit('3')); // display = '3'

    // Setting a different operator before "=" should trigger the pending
    // '+' computation in the background (5 + 3), using the backend, before
    // moving on to '-'.
    await act(async () => {
      result.current.setOperator('-');
      await Promise.resolve();
    });

    expect(mockedApi.add).toHaveBeenCalledTimes(1);
    expect(mockedApi.add).toHaveBeenCalledWith(5, 3);

    await waitFor(() => expect(result.current.display).toBe('8'));

    // Now finish with the new operator: operandA should be the backend
    // result (8), minus the next entered digit.
    act(() => result.current.inputDigit('2'));
    act(() => result.current.calculate());

    expect(mockedApi.subtract).toHaveBeenCalledWith(8, 2);
  });
});

describe('useCalculator - calculate', () => {
  it('calls the backend method matching the pending operator, updates the display, and refreshes history', async () => {
    mockedApi.multiply.mockResolvedValue({ result: 42 });
    const historyAfter = [makeHistoryItem({ id: 7 })];
    mockedApi.getHistory.mockResolvedValueOnce([]).mockResolvedValueOnce(historyAfter);

    const { result } = renderHook(() => useCalculator());
    await waitFor(() => expect(mockedApi.getHistory).toHaveBeenCalledTimes(1));

    act(() => result.current.inputDigit('6'));
    act(() => result.current.setOperator('*'));
    act(() => result.current.inputDigit('7'));

    await act(async () => {
      result.current.calculate();
      await Promise.resolve();
    });

    expect(mockedApi.multiply).toHaveBeenCalledWith(6, 7);
    await waitFor(() => expect(result.current.display).toBe('42'));
    await waitFor(() => expect(mockedApi.getHistory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.history).toEqual(historyAfter));
  });
});

describe('useCalculator - error path', () => {
  it('sets error state to the rejection message', async () => {
    mockedApi.divide.mockRejectedValue(new Error('Cannot divide by zero'));

    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.setOperator('/'));
    act(() => result.current.inputDigit('0'));

    await act(async () => {
      result.current.calculate();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toBe('Cannot divide by zero'));
  });

  it('falls back to a generic message for non-Error rejections', async () => {
    mockedApi.add.mockRejectedValue('network exploded');

    const { result } = renderHook(() => useCalculator());

    act(() => result.current.inputDigit('5'));
    act(() => result.current.setOperator('+'));
    act(() => result.current.inputDigit('1'));

    await act(async () => {
      result.current.calculate();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toBe('Calculation failed'));
  });
});

describe('useCalculator - delete then refetch', () => {
  it('deletes the entry then reloads history', async () => {
    const afterDelete = [makeHistoryItem({ id: 2 })];
    mockedApi.getHistory.mockResolvedValueOnce([]).mockResolvedValueOnce(afterDelete);
    mockedApi.deleteCalculation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCalculator());
    await waitFor(() => expect(mockedApi.getHistory).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.deleteFromHistory(5);
      await Promise.resolve();
    });

    expect(mockedApi.deleteCalculation).toHaveBeenCalledWith(5);
    await waitFor(() => expect(mockedApi.getHistory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.history).toEqual(afterDelete));
  });

  it('sets error state when delete fails and does not refetch history', async () => {
    mockedApi.deleteCalculation.mockRejectedValue(new Error('Calculation not found'));

    const { result } = renderHook(() => useCalculator());
    await waitFor(() => expect(mockedApi.getHistory).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.deleteFromHistory(5);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toBe('Calculation not found'));
    expect(mockedApi.getHistory).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic message when delete fails with a non-Error rejection', async () => {
    mockedApi.deleteCalculation.mockRejectedValue('network exploded');

    const { result } = renderHook(() => useCalculator());
    await waitFor(() => expect(mockedApi.getHistory).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.deleteFromHistory(5);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toBe('Calculation failed'));
    expect(mockedApi.getHistory).toHaveBeenCalledTimes(1);
  });
});

describe('useCalculator - operationSymbol', () => {
  it('maps known operations to their display symbol', () => {
    const { result } = renderHook(() => useCalculator());

    expect(result.current.operationSymbol('add')).toBe('+');
    expect(result.current.operationSymbol('sub')).toBe('-');
    expect(result.current.operationSymbol('mul')).toBe('×');
    expect(result.current.operationSymbol('div')).toBe('÷');
  });

  it('falls back to the raw operation string when unknown', () => {
    const { result } = renderHook(() => useCalculator());

    expect(result.current.operationSymbol('mystery')).toBe('mystery');
  });
});
