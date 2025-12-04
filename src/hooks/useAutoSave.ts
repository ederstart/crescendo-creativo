import { useRef, useCallback, useEffect } from 'react';

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  delay: number = 15000 // 15 seconds default
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>(JSON.stringify(data));
  const isSavingRef = useRef(false);

  const save = useCallback(async (dataToSave: T) => {
    const currentDataString = JSON.stringify(dataToSave);
    
    // Prevent duplicate saves
    if (currentDataString === lastSavedDataRef.current || isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    try {
      await onSave(dataToSave);
      lastSavedDataRef.current = currentDataString;
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave]);

  const debouncedSave = useCallback((dataToSave: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      save(dataToSave);
    }, delay);
  }, [save, delay]);

  // Trigger debounced save when data changes
  useEffect(() => {
    const currentDataString = JSON.stringify(data);
    if (currentDataString !== lastSavedDataRef.current) {
      debouncedSave(data);
    }
  }, [data, debouncedSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Force save immediately
  const forceSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    save(data);
  }, [save, data]);

  return { forceSave, isSaving: isSavingRef.current };
}
