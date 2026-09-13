export default function LoadingIndicator({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <div className="w-3 h-3 rounded-full border-2 border-slate-600 border-t-slate-400 animate-spin" />
      <span className="text-xs">{label}</span>
    </div>
  );
}
