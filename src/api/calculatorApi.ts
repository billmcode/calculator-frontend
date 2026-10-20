import type { CalculationResponse, ResultResponse } from '../types/calculator';

const baseUrl = '/api';

/**
 * Thrown whenever the backend responds with a non-2xx status.
 *
 * `message` is set to the backend's `detail` field when present (falling
 * back to 'Calculation failed' otherwise), so callers can simply do:
 *
 *   catch (err) {
 *     setError(err instanceof Error ? err.message : 'Calculation failed');
 *   }
 *
 * `detail` and `status` are exposed as well for callers that want the raw
 * values instead of the fallback-applied message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | undefined;

  constructor(status: number, detail: string | undefined) {
    super(detail || 'Calculation failed');
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function throwApiError(response: Response): Promise<never> {
  let detail: string | undefined;
  try {
    const body: unknown = await response.json();
    if (
      body !== null &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof (body as { detail: unknown }).detail === 'string'
    ) {
      detail = (body as { detail: string }).detail;
    }
  } catch {
    // Response body wasn't JSON (or was empty) - fall back below.
  }
  throw new ApiError(response.status, detail);
}

// fetch() rejects (rather than resolving with a non-ok Response) for
// network/transport-level failures: backend unreachable, DNS failure,
// CORS block, etc. Angular's HttpErrorResponse.error is a ProgressEvent
// (no `.detail`) in this case, so origin always fell back to the generic
// message here. Wrap the same way as a non-2xx response so callers never
// see a raw browser/network Error - they only ever see ApiError/.message.
async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  try {
    return await (init === undefined ? fetch(input) : fetch(input, init));
  } catch {
    throw new ApiError(0, undefined);
  }
}

async function calculate(operation: string, a: number, b: number): Promise<ResultResponse> {
  const response = await safeFetch(`${baseUrl}/calculations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, a, b }),
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  const calc = (await response.json()) as CalculationResponse;
  return { result: calc.result };
}

export function add(a: number, b: number): Promise<ResultResponse> {
  return calculate('add', a, b);
}

export function subtract(a: number, b: number): Promise<ResultResponse> {
  return calculate('sub', a, b);
}

export function multiply(a: number, b: number): Promise<ResultResponse> {
  return calculate('mul', a, b);
}

export function divide(a: number, b: number): Promise<ResultResponse> {
  return calculate('div', a, b);
}

export async function getHistory(): Promise<CalculationResponse[]> {
  const response = await safeFetch(`${baseUrl}/calculations`);

  if (!response.ok) {
    await throwApiError(response);
  }

  return (await response.json()) as CalculationResponse[];
}

export async function deleteCalculation(id: number): Promise<void> {
  const response = await safeFetch(`${baseUrl}/calculations/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await throwApiError(response);
  }
}
