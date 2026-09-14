import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";

// The sidebar is server-driven: core and platform sections are fixed by the runtime and
// Growth Apps reflects what is actually installed, so the frontend never keeps its own
// list of plugins that could drift from the registry.
export function useNavigation(enabled = true) {
  const [tree, setTree] = useState({ core: [], plugins: [], platform: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    try {
      setTree(await api.navigation());
      setError(null);
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { reload(); }, [reload]);

  return { ...tree, loading, error, reload };
}
