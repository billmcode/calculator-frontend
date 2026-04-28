import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ResultResponse {
  result: number;
}

export interface CalculationResponse {
  id: number;
  operation: string;
  a: number;
  b: number;
  result: number;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class CalculatorService {
  private http = inject(HttpClient);
  private baseUrl = '/api';

  add(a: number, b: number): Observable<ResultResponse> {
    return this.calculate('add', a, b);
  }

  subtract(a: number, b: number): Observable<ResultResponse> {
    return this.calculate('sub', a, b);
  }

  multiply(a: number, b: number): Observable<ResultResponse> {
    return this.calculate('mul', a, b);
  }

  divide(a: number, b: number): Observable<ResultResponse> {
    return this.calculate('div', a, b);
  }

  getHistory(): Observable<CalculationResponse[]> {
    return this.http.get<CalculationResponse[]>(`${this.baseUrl}/calculations`);
  }

  deleteCalculation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/calculations/${id}`);
  }

  private calculate(operation: string, a: number, b: number): Observable<ResultResponse> {
    return this.http
      .post<CalculationResponse>(`${this.baseUrl}/calculations`, { operation, a, b })
      .pipe(map((calc) => ({ result: calc.result })));
  }
}
