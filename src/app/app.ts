import { Component, OnInit, inject, signal } from '@angular/core';
import { CalculatorService, CalculationResponse } from './calculator.service';

const OP_SYMBOLS: Record<string, string> = {
  add: '+',
  sub: '-',
  mul: '×',
  div: '÷',
};

const KEY_SYMBOLS: Record<string, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private calc = inject(CalculatorService);

  display = signal('0');
  expression = signal('');
  error = signal('');
  history = signal<CalculationResponse[]>([]);

  private operandA: number | null = null;
  private operator: string | null = null;
  private waitingForOperand = false;

  ngOnInit() {
    this.loadHistory();
  }

  inputDigit(digit: string) {
    this.error.set('');
    if (this.waitingForOperand) {
      this.display.set(digit);
      this.waitingForOperand = false;
    } else {
      this.display.set(this.display() === '0' ? digit : this.display() + digit);
    }
  }

  inputDecimal() {
    this.error.set('');
    if (this.waitingForOperand) {
      this.display.set('0.');
      this.waitingForOperand = false;
      return;
    }
    if (!this.display().includes('.')) {
      this.display.set(this.display() + '.');
    }
  }

  toggleSign() {
    const val = parseFloat(this.display());
    this.display.set(String(-val));
  }

  inputPercent() {
    const val = parseFloat(this.display());
    this.display.set(String(val / 100));
  }

  setOperator(op: string) {
    this.error.set('');
    const current = parseFloat(this.display());

    if (this.operandA !== null && !this.waitingForOperand) {
      this.callBackend(this.operandA, parseFloat(this.display()), this.operator!, false);
    } else {
      this.operandA = current;
    }

    this.operator = op;
    this.waitingForOperand = true;
    this.expression.set(`${this.operandA} ${KEY_SYMBOLS[op]}`);
  }

  calculate() {
    if (this.operator === null || this.operandA === null) return;

    const b = parseFloat(this.display());
    this.expression.set(`${this.operandA} ${KEY_SYMBOLS[this.operator]} ${b} =`);
    this.callBackend(this.operandA, b, this.operator, true);
  }

  clear() {
    this.display.set('0');
    this.expression.set('');
    this.error.set('');
    this.operandA = null;
    this.operator = null;
    this.waitingForOperand = false;
  }

  operationSymbol(op: string): string {
    return OP_SYMBOLS[op] || op;
  }

  deleteFromHistory(id: number) {
    this.calc.deleteCalculation(id).subscribe(() => this.loadHistory());
  }

  private callBackend(a: number, b: number, op: string, clearOp: boolean) {
    const methods: Record<string, (a: number, b: number) => ReturnType<CalculatorService['add']>> = {
      '+': (x, y) => this.calc.add(x, y),
      '-': (x, y) => this.calc.subtract(x, y),
      '*': (x, y) => this.calc.multiply(x, y),
      '/': (x, y) => this.calc.divide(x, y),
    };

    const method = methods[op];
    if (!method) return;

    method(a, b).subscribe({
      next: (res) => {
        this.display.set(String(res.result));
        this.operandA = res.result;
        if (clearOp) {
          this.operator = null;
        }
        this.waitingForOperand = true;
        this.loadHistory();
      },
      error: (err: any) => {
        this.error.set(err.error?.detail || 'Calculation failed');
      },
    });
  }

  private loadHistory() {
    this.calc.getHistory().subscribe({
      next: (data) => this.history.set(data),
      error: () => {},
    });
  }
}
