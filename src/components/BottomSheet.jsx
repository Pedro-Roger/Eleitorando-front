import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { useModalLayer } from '../lib/modalStack';

export default function BottomSheet({ open, onClose, title, hideHeader = false, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const layerId = useId();
  // Só o modal no topo da pilha (isTop) mostra backdrop/painel e captura
  // foco/teclado. Modais abertos "por baixo" (ex.: formulário ainda aberto
  // quando um alerta de erro aparece por cima) continuam montados — sem
  // perder o que o usuário já digitou — mas ficam ocultos até voltarem ao
  // topo, evitando dois `.sheet-backdrop` sobrepostos na tela ao mesmo tempo.
  const { isTop } = useModalLayer(layerId, open);

  useEffect(() => {
    if (!open || !isTop) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    )];

    focusable()[0]?.focus();
    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus?.();
    };
  }, [open, isTop, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className={`sheet-backdrop${isTop ? '' : ' sheet-backdrop--behind'}`}
      onClick={(e) => isTop && e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal={isTop}
        aria-hidden={!isTop}
        aria-labelledby={title ? titleId : undefined}
        ref={dialogRef}
      >
        <div className="sheet-handle" />
        {!hideHeader && (
          <div className="sheet-title">
            {title && <h2 id={titleId}>{title}</h2>}
            <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
              <Icon name="close" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    // Escapa de .app-scroll (overflow-y:auto + -webkit-overflow-scrolling:touch):
    // no iOS Safari, position:fixed dentro desse tipo de contêiner fica "preso" e
    // se comporta como position:absolute relativo a ele em vez da viewport — por
    // isso a tabbar (irmã de .app-scroll, fora dele) aparecia por cima do sheet.
    document.getElementById('modal-root') || document.body,
  );
}
