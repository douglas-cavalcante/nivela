import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Chama `reload` cada vez que a tela volta ao foco (ex.: ao voltar da prática para uma aba que
 * continua montada). O primeiro foco é ignorado: a busca inicial já cobre esse momento.
 */
export function useReloadOnFocus(reload: () => void): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      reload();
    }, [reload]),
  );
}
