import { useState, useEffect, useCallback } from 'react';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T | null>;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  apiCall: (...args: any[]) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiResult<T> {
  const { immediate = false, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiCall(...args);
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiCall, onSuccess, onError]
  );

  const refetch = useCallback(async () => {
    await execute();
  }, [execute]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { data, loading, error, execute, refetch };
}

export function usePolling<T>(
  apiCall: () => Promise<T>,
  interval: number = 5000,
  enabled: boolean = true
): UseApiResult<T> {
  const { data, loading, error, execute, refetch } = useApi(apiCall, { immediate: enabled });

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      execute();
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, interval, execute]);

  return { data, loading, error, execute, refetch };
}