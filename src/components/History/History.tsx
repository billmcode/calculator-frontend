// History panel component, ported from src/app/app.html. Presentational
// only - history state and the delete-then-refetch logic live in
// useCalculator().
import type { CalculationResponse } from '../../types/calculator';
import styles from './History.module.css';

export interface HistoryProps {
  history: CalculationResponse[];
  operationSymbol: (op: string) => string;
  onDelete: (id: number) => void;
}

function History({ history, operationSymbol, onDelete }: HistoryProps) {
  return (
    <div className={styles['historyPanel']}>
      <h2>History</h2>
      {history.length === 0 && <p className={styles['empty']}>No calculations yet.</p>}
      <ul>
        {history.map((item) => (
          <li key={item.id}>
            <span className={styles['calcText']}>
              {item.a} {operationSymbol(item.operation)} {item.b} = {item.result}
            </span>
            <button className={styles['deleteBtn']} onClick={() => onDelete(item.id)} title="Delete">
              &times;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default History;
