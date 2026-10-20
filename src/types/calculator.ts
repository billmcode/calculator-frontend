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
