import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createInitialState, reduce } from "../sim/engine";
import type { SimAction, SimState } from "../sim/types";

interface SimContextValue {
  state: SimState;
  dispatch: Dispatch<SimAction>;
  speed: number;
  setSpeed: (speed: number) => void;
  paused: boolean;
  setPaused: Dispatch<SetStateAction<boolean>>;
  reset: () => void;
}

const SimContext = createContext<SimContextValue | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, () => createInitialState());
  const [speed, updateSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const setSpeed = useCallback((next: number) => {
    if (Number.isFinite(next) && next > 0) updateSpeed(next);
  }, []);
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    updateSpeed(1);
    setPaused(false);
  }, []);

  useEffect(() => {
    if (paused) return;
    let frame: number | null = null;
    let previous: number | null = null;
    const animate = (timestamp: number) => {
      frame = null;
      if (document.hidden) { previous = null; return; }
      if (previous !== null) dispatch({ type: "tick", dtMs: (timestamp - previous) * speed });
      previous = timestamp;
      frame = requestAnimationFrame(animate);
    };
    const visibility = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = null; // Never count the hidden interval when the tab returns.
      if (!document.hidden) frame = requestAnimationFrame(animate);
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [speed, paused]);

  const value = useMemo(() => ({ state, dispatch, speed, setSpeed, paused, setPaused, reset }), [state, speed, setSpeed, paused, reset]);
  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim() {
  const value = useContext(SimContext);
  if (!value) throw new Error("useSim harus berada di dalam SimProvider.");
  return value;
}
