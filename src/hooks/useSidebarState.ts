import { useState, useEffect, useCallback } from 'react';

// Simple module-level state for sidebar
let sidebarCollapsed = false;
const listeners = new Set<(collapsed: boolean) => void>();

function notifyListeners() {
  listeners.forEach(l => l(sidebarCollapsed));
}

export function useSidebarState() {
  const [collapsed, setLocalCollapsed] = useState(sidebarCollapsed);

  useEffect(() => {
    const listener = (value: boolean) => setLocalCollapsed(value);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    sidebarCollapsed = value;
    notifyListeners();
  }, []);

  const toggle = useCallback(() => {
    sidebarCollapsed = !sidebarCollapsed;
    notifyListeners();
  }, []);

  return { collapsed, setCollapsed, toggle };
}
