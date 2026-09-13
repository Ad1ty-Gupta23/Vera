export default function MemoryPanel({ memories = [] }) {
  return (
    <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-4">
      <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 mb-3">Memory</p>
      {memories.length === 0 ? (
        <p className="text-xs text-slate-600">No relevant memory</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {memories.map((mem, i) => (
            <li key={i} className="text-xs text-slate-400 border-l-2 border-slate-700 pl-2">
              {mem.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
