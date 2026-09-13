export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-14">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mb-4 text-slate-500">
          {icon}
        </div>
      )}
      <h3 className="text-slate-200 font-medium text-sm">{title}</h3>
      {description && (
        <p className="text-slate-500 text-xs mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
