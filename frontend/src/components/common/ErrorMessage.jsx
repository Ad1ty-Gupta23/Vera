export default function ErrorMessage({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
      <span className="text-xs leading-relaxed flex-1">{error}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-300 text-xs transition-colors focus:outline-none"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
