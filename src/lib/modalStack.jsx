import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Pilha global de modais (BottomSheet/ConfirmDialog/AlertDialog) atualmente
// abertos. Sem isso, telas que abrem um modal a partir de dentro de outro
// (ex.: "Excluir" dentro do detalhe de um membro da equipe, ou o aviso de
// telefone duplicado em cima do formulário de cadastro) acabavam renderizando
// dois `.sheet-backdrop` sobrepostos ao mesmo tempo — dois fundos escurecidos
// e dois painéis brancos por cima um do outro, o bug de "modais sobrepostos"
// no mobile.
const ModalStackContext = createContext(null);

export function ModalStackProvider({ children }) {
  const [stack, setStack] = useState([]);

  const api = useMemo(() => ({
    stack,
    push(id) {
      setStack((current) => (current.includes(id) ? current : [...current, id]));
    },
    pop(id) {
      setStack((current) => current.filter((item) => item !== id));
    },
  }), [stack]);

  return <ModalStackContext.Provider value={api}>{children}</ModalStackContext.Provider>;
}

// Registra `id` na pilha enquanto `open` for verdadeiro. Retorna `isTop`,
// indicando se este é o modal mais recente aberto — só ele deve exibir seu
// backdrop/painel, capturar foco e responder a Escape/Tab. Os demais
// continuam montados (preservando estado de formulários) mas ficam ocultos
// até voltarem ao topo da pilha.
export function useModalLayer(id, open) {
  const ctx = useContext(ModalStackContext);
  if (!ctx) throw new Error('useModalLayer precisa de um ModalStackProvider por perto.');
  const { stack, push, pop } = ctx;

  useEffect(() => {
    if (!open) return undefined;
    push(id);
    return () => pop(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const isTop = open && stack.length > 0 && stack[stack.length - 1] === id;
  return { isTop };
}
