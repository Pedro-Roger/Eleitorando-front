import BottomSheet from './BottomSheet';
import Icon from './Icon';

// Aviso simples com um único botão — usado para mensagens que precisam de
// destaque maior que o alert inline (ex.: telefone já cadastrado).
export default function AlertDialog({ open, onClose, title, description, buttonLabel = 'Entendi' }) {
  return (
    <BottomSheet open={open} onClose={onClose} hideHeader>
      <div className="confirm-dialog">
        <div className="confirm-icon">
          <Icon name="warning" filled size={28} />
        </div>
        <h2 className="confirm-title">{title}</h2>
        <p className="confirm-description">{description}</p>
        <button className="btn pill" type="button" onClick={onClose}>{buttonLabel}</button>
      </div>
    </BottomSheet>
  );
}
