import DiagramRenderer from './DiagramRenderer';
import Scene3DRenderer from './Scene3DRenderer';
import ImagePanel from './ImagePanel';

/**
 * Expects vera.visualType / vera.visualSpec / vera.visualVisible from
 * VERAContext (see INTEGRATION.md). Renders nothing when no visual is
 * active — Dashboard.jsx decides whether to show this alongside or
 * instead of MapPanel.
 */
export default function VisualPanel({ visualType, visualSpec, visible }) {
  if (!visible || !visualSpec || visualType === 'none') return null;

  return (
    <div
      className="w-full h-full bg-slate-950/60 rounded-xl border border-slate-800/70 overflow-hidden"
      style={{ minHeight: 420, height: '100%' }}
    >
      {visualType === 'diagram' && <DiagramRenderer spec={visualSpec.diagram} />}
      {visualType === 'scene_3d' && <Scene3DRenderer spec={visualSpec.scene3d} />}
      {(visualType === 'image_generated' || visualType === 'image_retrieved') && (
        <ImagePanel spec={visualSpec} resolvedUrl={visualSpec.image?.resolved_url} />
      )}
    </div>
  );
}