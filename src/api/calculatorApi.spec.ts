// Tests for the fetch-based API module, in isolation from React. `fetch` is
// stubbed globally so these tests exercise only calculatorApi's request
// shaping and response/error handling.
import { add, subtract, multiply, divide, getHistory, deleteCalculation, ApiError } from './calculatorApi';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response;
}

function emptyErrorResponse(status = 500) {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error('Unexpected token in JSON')),
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('calculatorApi - arithmetic operations', () => {
  it.each([
    ['add', add, 'add'],
    ['subtract', subtract, 'sub'],
    ['multiply', multiply, 'mul'],
    ['divide', divide, 'div'],
  ] as const)('%s posts the right operation payload and resolves to just the result', async (_label, fn, operation) => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 1, operation, a: 4, b: 2, result: 99, created_at: '2024-01-01T00:00:00Z' }),
    );

    const result = await fn(4, 2);

    expect(fetchMock).toHaveBeenCalledWith('/api/calculations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, a: 4, b: 2 }),
    });
    // Resolves to just { result }, not the full calculation record.
    expect(result).toEqual({ result: 99 });
  });
});

describe('calculatorApi - getHistory', () => {
  it('GETs the collection and resolves to the full array as-is', async () => {
    const records = [
      { id: 1, operation: 'add', a: 1, b: 2, result: 3, created_at: '2024-01-01T00:00:00Z' },
      { id: 2, operation: 'mul', a: 3, b: 4, result: 12, created_at: '2024-01-02T00:00:00Z' },
    ];
    fetchMock.mockResolvedValue(jsonResponse(records));

    const result = await getHistory();

    expect(fetchMock).toHaveBeenCalledWith('/api/calculations');
    expect(result).toEqual(records);
  });
});

describe('calculatorApi - deleteCalculation', () => {
  it('DELETEs the record by id and resolves to undefined without parsing a body', async () => {
    const json = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, status: 204, json });

    const result = await deleteCalculation(5);

    expect(fetchMock).toHaveBeenCalledWith('/api/calculations/5', { method: 'DELETE' });
    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});

describe('calculatorApi - error handling', () => {
  it('rejects with the backend detail message when the response is not ok', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'some message' }, { ok: false, status: 400 }));

    await expect(add(1, 2)).rejects.toMatchObject({ message: 'some message' });
  });

  it('exposes status and detail on the thrown ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'bad input' }, { ok: false, status: 422 }));

    await expect(add(1, 2)).rejects.toBeInstanceOf(ApiError);
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'bad input' }, { ok: false, status: 422 }));
    try {
      await add(1, 2);
      expect.unreachable('add() should have rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.detail).toBe('bad input');
    }
  });

  it('falls back to "Calculation failed" when the error body has no usable detail', async () => {
    fetchMock.mockResolvedValue(emptyErrorResponse(500));

    await expect(getHistory()).rejects.toMatchObject({ message: 'Calculation failed' });
  });

  it('falls back to "Calculation failed" when the error body is JSON without a detail field', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ foo: 'bar' }, { ok: false, status: 500 }));

    await expect(deleteCalculation(1)).rejects.toMatchObject({ message: 'Calculation failed' });
  });
});
