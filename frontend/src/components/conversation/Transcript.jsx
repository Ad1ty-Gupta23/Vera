export default function Transcript({ partialTranscript }) {
  if (!partialTranscript) return null;

  return (
    <div
      className="mx-1 px-4 py-3 rounded-2xl rounded-bl-sm border"
      style={{
        background: 'rgba(113,145,255,0.06)',
        borderColor: 'rgba(113,145,255,0.2)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-[#7191FF] animate-pulse" />
        <span className="text-[10px] uppercase tracking-widest text-[#7191FF] font-semibold">Listening…</span>
      </div>
      <p className="text-sm text-[#A7AEC4] italic leading-relaxed">
        {partialTranscript}
        <span className="inline-block ml-1 w-[3px] h-3.5 bg-[#7191FF] opacity-80 animate-pulse align-middle rounded-full" />
      </p>
    </div>
  );
}
