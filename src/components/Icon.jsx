export default function Icon({ name, filled = false, size = 24, color, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={{ color, fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
