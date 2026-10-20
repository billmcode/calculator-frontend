import type { CalculationResponse } from '../types/calculator';

export function makeCalculationResponse(
  overrides: Partial<CalculationResponse> = {},
): CalculationResponse {
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
