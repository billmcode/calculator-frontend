// Keypad + display component, ported from src/app/app.html. Presentational
// only - all state/behavior lives in useCalculator().
import styles from './Calculator.module.css';

function cx(...classes: Array<string | false | undefined | null>): string {
  return classes.filter(Boolean).join(' ');
}

export interface CalculatorProps {
  display: string;
  expression: string;
  error: string;
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onToggleSign: () => void;
  onPercent: () => void;
  onOperator: (op: string) => void;
  onCalculate: () => void;
  onClear: () => void;
}

function Calculator({
  display,
  expression,
  error,
  onDigit,
  onDecimal,
  onToggleSign,
  onPercent,
  onOperator,
  onCalculate,
  onClear,
}: CalculatorProps) {
  return (
    <div className={styles['calculator']}>
      <div className={styles['display']}>
        <div className={styles['expression']}>{expression}</div>
        <div className={styles['result']}>{display}</div>
      </div>

      <div className={styles['buttons']}>
        <button className={cx(styles['btn'], styles['clear'])} onClick={onClear}>
          C
        </button>
        <button className={cx(styles['btn'], styles['operator'])} onClick={onToggleSign}>
          +/-
        </button>
        <button className={cx(styles['btn'], styles['operator'])} onClick={onPercent}>
          %
        </button>
        <button className={cx(styles['btn'], styles['operator'])} onClick={() => onOperator('/')}>
          ÷
        </button>

        <button className={styles['btn']} onClick={() => onDigit('7')}>
          7
        </button>
        <button className={styles['btn']} onClick={() => onDigit('8')}>
          8
        </button>
        <button className={styles['btn']} onClick={() => onDigit('9')}>
          9
        </button>
        <button className={cx(styles['btn'], styles['operator'])} onClick={() => onOperator('*')}>
          ×
        </button>

        <button className={styles['btn']} onClick={() => onDigit('4')}>
          4
        </button>
        <button className={styles['btn']} onClick={() => onDigit('5')}>
          5
        </button>
        <button className={styles['btn']} onClick={() => onDigit('6')}>
          6
        </button>
        <button className={cx(styles['btn'], styles['operator'])} onClick={() => onOperator('-')}>
          −
        </button>

        <button className={styles['btn']} onClick={() => onDigit('1')}>
          1
        </button>
        <button className={styles['btn']} onClick={() => onDigit('2')}>
          2
        </button>
        <button className={styles['btn']} onClick={() => onDigit('3')}>
          3
        </button>
        <button className={cx(styles['btn'], styles['operator'])} onClick={() => onOperator('+')}>
          +
        </button>

        <button className={cx(styles['btn'], styles['zero'])} onClick={() => onDigit('0')}>
          0
        </button>
        <button className={styles['btn']} onClick={onDecimal}>
          .
        </button>
        <button className={cx(styles['btn'], styles['equals'])} onClick={onCalculate}>
          =
        </button>
      </div>

      {error && <div className={styles['error']}>{error}</div>}
    </div>
  );
}

export default Calculator;
