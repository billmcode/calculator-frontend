import Calculator from './components/Calculator/Calculator';
import { useCalculator } from './components/Calculator/useCalculator';
import History from './components/History/History';
import styles from './App.module.css';

function App() {
  const calculator = useCalculator();

  return (
    <div className={styles['calculatorApp']}>
      <Calculator
        display={calculator.display}
        expression={calculator.expression}
        error={calculator.error}
        onDigit={calculator.inputDigit}
        onDecimal={calculator.inputDecimal}
        onToggleSign={calculator.toggleSign}
        onPercent={calculator.inputPercent}
        onOperator={calculator.setOperator}
        onCalculate={calculator.calculate}
        onClear={calculator.clear}
      />
      <History
        history={calculator.history}
        operationSymbol={calculator.operationSymbol}
        onDelete={calculator.deleteFromHistory}
      />
    </div>
  );
}

export default App;
