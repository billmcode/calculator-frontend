// Calculator engine + history hook, ported 1:1 from src/app/app.ts (the
// Angular `App` component). Kept framework-agnostic in spirit so it can be
// unit-tested in isolation (e.g. with @testing-library/react-hooks or
// renderHook): it owns all state and exposes plain handlers, with no JSX.
//
// operandA / operator / waitingForOperand are intentionally kept in refs
// rather than state, mirroring the plain (non-signal) fields on the Angular
// component - they don't need to independently trigger re-renders, only the
// values derived from them (display/expression) do.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as calculatorApi from '../../api/calculatorApi';
import type { CalculationResponse } from '../../types/calculator';

const OP_SYMBOLS: Record<string, string> = {
  add: '+',
  sub: '-',
  mul: '×',
  div: '÷',
};

export function operationSymbol(op: string): string {
  return OP_SYMBOLS[op] || op;
}

const KEY_SYMBOLS: Record<string, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

type BackendMethod = (a: number, b: number) => ReturnType<typeof calculatorApi.add>;

const BACKEND_METHODS: Record<string, BackendMethod> = {
  '+': calculatorApi.add,
  '-': calculatorApi.subtract,
  '*': calculatorApi.multiply,
  '/': calculatorApi.divide,
};

export function useCalculator() {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CalculationResponse[]>([]);

  const operandARef = useRef<number | null>(null);
  const operatorRef = useRef<string | null>(null);
  const waitingForOperandRef = useRef(false);

  const loadHistory = useCallback(() => {
    calculatorApi.getHistory().then(
      (data) => setHistory(data),
      () => {
        // Swallow errors silently, matching Angular's `error: () => {}`.
      },
    );
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const callBackend = useCallback(
    (a: number, b: number, op: string, clearOp: boolean) => {
      const method = BACKEND_METHODS[op];
      if (!method) return;

      method(a, b).then(
        (res) => {
          setDisplay(String(res.result));
          operandARef.current = res.result;
          if (clearOp) {
            operatorRef.current = null;
          }
          waitingForOperandRef.current = true;
          loadHistory();
        },
        (err: unknown) => {
          setError(err instanceof Error ? err.message : 'Calculation failed');
        },
      );
    },
    [loadHistory],
  );

  const inputDigit = useCallback((digit: string) => {
    setError('');
    if (waitingForOperandRef.current) {
      setDisplay(digit);
      waitingForOperandRef.current = false;
    } else {
      setDisplay((prev) => (prev === '0' ? digit : prev + digit));
    }
  }, []);

  const inputDecimal = useCallback(() => {
    setError('');
    if (waitingForOperandRef.current) {
      setDisplay('0.');
      waitingForOperandRef.current = false;
      return;
    }
    setDisplay((prev) => (prev.includes('.') ? prev : prev + '.'));
  }, []);

  const toggleSign = useCallback(() => {
    setDisplay((prev) => String(-parseFloat(prev)));
  }, []);

  const inputPercent = useCallback(() => {
    setDisplay((prev) => String(parseFloat(prev) / 100));
  }, []);

  const setOperator = useCallback(
    (op: string) => {
      setError('');
      const current = parseFloat(display);

      if (operandARef.current !== null && !waitingForOperandRef.current) {
        callBackend(operandARef.current, parseFloat(display), operatorRef.current!, false);
      } else {
        operandARef.current = current;
      }

      operatorRef.current = op;
      waitingForOperandRef.current = true;
      setExpression(`${operandARef.current} ${KEY_SYMBOLS[op]}`);
    },
    [display, callBackend],
  );

  const calculate = useCallback(() => {
    if (operatorRef.current === null || operandARef.current === null) return;

    const b = parseFloat(display);
    setExpression(`${operandARef.current} ${KEY_SYMBOLS[operatorRef.current]} ${b} =`);
    callBackend(operandARef.current, b, operatorRef.current, true);
  }, [display, callBackend]);

  const clear = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setError('');
    operandARef.current = null;
    operatorRef.current = null;
    waitingForOperandRef.current = false;
  }, []);

  const deleteFromHistory = useCallback(
    (id: number) => {
      calculatorApi.deleteCalculation(id).then(
        () => loadHistory(),
        (err: unknown) => {
          setError(err instanceof Error ? err.message : 'Calculation failed');
        },
      );
    },
    [loadHistory],
  );

  return {
    display,
    expression,
    error,
    history,
    inputDigit,
    inputDecimal,
    toggleSign,
    inputPercent,
    setOperator,
    calculate,
    clear,
    operationSymbol,
    deleteFromHistory,
  };
}
