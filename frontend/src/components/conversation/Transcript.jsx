export default function Transcript({ partialTranscript }) {
  if (!partialTranscript) return null;

  return (
    <div className="px-4 py-2 mx-1 rounded-xl bg-slate-800/40 border border-slate-700/30">
      <p className="text-sm text-slate-400 italic leading-relaxed">
        {partialTranscript}
        <span className="inline-block ml-1 w-1 h-3 bg-violet-400 opacity-80 animate-pulse align-middle" />
      </p>
    </div>
  );
}
