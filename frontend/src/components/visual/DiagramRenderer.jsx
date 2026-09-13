import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useMeasuredSize } from '../../hooks/useMeasuredSize';

const ICON = {
  user: '🧑', browser: '🖥️', server: '🛰️', database: '🗄️',
  api: '🔌', lock: '🔒', key: '🔑', cloud: '☁️', queue: '📬', generic: '▫️',
};

const GROUP_COLOR = {
  frontend: '#38bdf8', backend: '#a78bfa', database: '#34d399',
  external: '#f59e0b', security: '#f87171',
};

function layout(nodes, direction) {
  const byLevel = new Map();
  nodes.forEach((n) => {
    const lvl = n.level ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(n);
  });

  const horizontal = direction !== 'vertical';
  const levelGap = 220;
  const itemGap = 120;

  const positioned = [];
  [...byLevel.keys()].sort((a, b) => a - b).forEach((lvl) => {
    const items = byLevel.get(lvl);
    items.forEach((n, i) => {
      const cross = (i - (items.length - 1) / 2) * itemGap;
      positioned.push({
        ...n,
        position: horizontal
          ? { x: lvl * levelGap, y: cross }
          : { x: cross, y: lvl * levelGap },
      });
    });
  });
  return positioned;
}

export default function DiagramRenderer({ spec }) {
  const [measureRef, size] = useMeasuredSize();
  const ready = size.width > 0 && size.height > 0;

  const { nodes, edges } = useMemo(() => {
    if (!spec) return { nodes: [], edges: [] };
    const horizontal = spec.direction !== 'vertical';
    const laidOut = layout(spec.nodes, spec.direction);

    const rfNodes = laidOut.map((n) => ({
      id: n.id,
      position: n.position,
      sourcePosition: horizontal ? Position.Right : Position.Bottom,
      targetPosition: horizontal ? Position.Left : Position.Top,
      data: { label: (
        <div className="text-center">
          <div className="text-base leading-none mb-1">{ICON[n.icon] ?? ICON.generic}</div>
          <div className="text-xs font-semibold">{n.label}</div>
          {n.description && (
            <div className="text-[10px] opacity-70 mt-0.5 max-w-[140px]">{n.description}</div>
          )}
        </div>
      ) },
      style: {
        background: n.highlighted ? '#1e293b' : '#0f172a',
        border: `2px solid ${n.highlighted ? '#fbbf24' : (GROUP_COLOR[n.group] ?? '#475569')}`,
        borderRadius: 12,
        color: '#e2e8f0',
        padding: 10,
        width: 160,
        boxShadow: n.highlighted ? '0 0 16px rgba(251,191,36,0.35)' : 'none',
      },
    }));

    const rfEdges = spec.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.animated,
      style: { stroke: '#64748b', strokeDasharray: e.style === 'dashed' ? '5 5' : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      labelStyle: { fill: '#94a3b8', fontSize: 11 },
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [spec]);

  if (!spec) return null;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-4 py-2 text-sm font-semibold text-slate-200 border-b border-slate-800/70">
        {spec.title}
      </div>
      {/* ReactFlow measures ITS OWN parent's box at mount time to size its
          internal canvas. Inside a flex layout (especially one that's
          conditionally rendered, like this panel), that box can measure
          0x0 on the very first paint, before flex has finished settling —
          ReactFlow doesn't always recover from that on its own. So we hold
          off mounting ReactFlow until we have a real, non-zero
          measurement, and force a clean remount via `key` once we do.
          Without this, ReactFlow silently renders nothing, and against
          this dark panel background that looks exactly like a black
          screen. */}
      <div ref={measureRef} className="flex-1 relative" style={{ minHeight: 380 }}>
        {ready ? (
          <ReactFlow
            key={`${Math.round(size.width)}x${Math.round(size.height)}-init`}
            nodes={nodes}
            edges={edges}
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={2}
            style={{ width: '100%', height: '100%' }}
          >
            <Background color="#1e293b" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            Preparing diagram…
          </div>
        )}
      </div>
    </div>
  );
}