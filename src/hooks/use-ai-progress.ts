import { useEffect, useRef, useState } from "react";

/**
 * Hook compartilhado para todos os fluxos de IA com loading.
 * Gera uma curva de progresso suave (easeOutQuad) com leve overshoot
 * após a duração esperada, e cronometra o tempo decorrido.
 *
 * Quando `loading` vira true: reseta e começa a contar.
 * Quando `loading` vira false: para o tick (a UI deve fechar o modal).
 *
 * Retorna também `remainingMs` (tempo estimado restante até `expectedMs`)
 * e `isOvertime` (quando o tempo decorrido ultrapassa o esperado).
 */
export function useAIProgress(loading: boolean, expectedMs = 8000) {
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setProgress(0);
      setElapsedMs(0);
      startRef.current = Date.now();
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        setElapsedMs(elapsed);
        const ratio = Math.min(elapsed / expectedMs, 1);
        const eased = 1 - Math.pow(1 - ratio, 2); // easeOutQuad
        const target = eased * 90;
        const overshoot = elapsed > expectedMs
          ? Math.min(5, ((elapsed - expectedMs) / 4000) * 5)
          : 0;
        setProgress(Math.min(95, target + overshoot));
      }, 100);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      // jump to 100% on completion for smooth close
      if (startRef.current > 0) {
        setProgress(100);
        setElapsedMs(Date.now() - startRef.current);
      }
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [loading, expectedMs]);

  const remainingMs = Math.max(0, expectedMs - elapsedMs);
  const isOvertime = loading && elapsedMs > expectedMs;

  return { progress, elapsedMs, remainingMs, isOvertime };
}
