import BottomSheet from './BottomSheet';
import Icon from './Icon';

// Confirmação para ações destrutivas (excluir) — ícone de alerta, título e
// descrição centralizados, botões empilhados com a ação destrutiva em cima.
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
}) {
  return (
    <BottomSheet open={open} onClose={onClose} hideHeader>
      <div className="confirm-dialog">
        <div className="confirm-icon">
          <Icon name="warning" filled size={28} />
        </div>
        <h2 className="confirm-title">{title}</h2>
        <p className="confirm-description">{description}</p>
        <button className="btn pill danger" type="button" onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn pill outline" type="button" onClick={onClose}>{cancelLabel}</button>
      </div>
    </BottomSheet>
  );
}
