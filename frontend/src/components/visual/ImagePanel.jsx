export default function ImagePanel({ spec, resolvedUrl, loading }) {
  if (!spec) return null;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-4 py-2 text-sm font-semibold text-slate-200 border-b border-slate-800/70">
        {spec.title}
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        {loading || !resolvedUrl ? (
          <div className="text-slate-500 text-sm animate-pulse">
            {spec.image?.mode === 'generate' ? 'Generating illustration…' : 'Finding a reference image…'}
          </div>
        ) : (
          <figure className="max-h-full">
            <img
              src={resolvedUrl}
              alt={spec.image?.caption ?? spec.title}
              className="max-h-[70vh] rounded-lg border border-slate-800 object-contain"
            />
            {spec.image?.caption && (
              <figcaption className="text-xs text-slate-500 mt-2 text-center">
                {spec.image.caption}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </div>
  );
}
