import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, ContactShadows } from '@react-three/drei';
import { useMeasuredSize } from '../../hooks/useMeasuredSize';

const PRIMITIVE_GEOMETRY = {
  sphere: <sphereGeometry args={[1, 32, 32]} />,
  box: <boxGeometry args={[1, 1, 1]} />,
  cylinder: <cylinderGeometry args={[1, 1, 1, 32]} />,
  cone: <coneGeometry args={[1, 1.5, 32]} />,
  torus: <torusGeometry args={[1, 0.35, 16, 64]} />,
  plane: <planeGeometry args={[2, 2]} />,
};

function GltfObject({ url, ...rest }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} {...rest} />;
}

function SceneObject({ obj, assetUrls }) {
  const resolvedUrl = obj.kind === 'glb_model' ? assetUrls?.[obj.id] : null;

  return (
    <group
      position={obj.position}
      rotation={obj.rotation}
      scale={obj.scale}
    >
      {resolvedUrl ? (
        <Suspense fallback={<mesh>{PRIMITIVE_GEOMETRY.sphere}<meshStandardMaterial color={obj.color ?? '#94a3b8'} wireframe /></mesh>}>
          <GltfObject url={resolvedUrl} />
        </Suspense>
      ) : (
        <mesh>
          {PRIMITIVE_GEOMETRY[obj.primitive ?? 'sphere']}
          <meshStandardMaterial
            color={obj.color ?? '#94a3b8'}
            emissive={obj.highlighted ? '#fbbf24' : '#000000'}
            emissiveIntensity={obj.highlighted ? 0.4 : 0}
          />
        </mesh>
      )}
      <Html distanceFactor={10} position={[0, 1.3, 0]} center>
        <div className="px-2 py-0.5 rounded bg-slate-900/80 text-[10px] text-slate-200 whitespace-nowrap border border-slate-700">
          {obj.label}
        </div>
      </Html>
    </group>
  );
}

/**
 * `assetUrls`: optional { [objectId]: resolvedGlbUrl } map. VisualPanel
 * resolves each object's `asset_query` to a real URL (asset service / search)
 * before rendering here — the LLM only ever supplies a search query, never
 * a file path.
 */
export default function Scene3DRenderer({ spec, assetUrls }) {
  const objects = useMemo(() => spec?.objects ?? [], [spec]);
  const [measureRef, size] = useMeasuredSize();
  const ready = size.width > 0 && size.height > 0;

  if (!spec) return null;

  const bg = spec.background ?? '#0b1220';

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-4 py-2 text-sm font-semibold text-slate-200 border-b border-slate-800/70">
        {spec.title}
      </div>
      {/*
        Two separate bugs used to live here, both producing a "black screen":

        1) SIZING: <Canvas> reads its parent element's box once, at mount,
           to size its WebGL drawing buffer. Inside a flex layout that box
           can measure 0x0 on the very first paint (before flex settles),
           and the canvas never recovers on its own. Fix: measure the
           container ourselves and don't mount <Canvas> until we have a
           real, non-zero size (remounting via `key` if it changes).

        2) LIGHTING: modern three.js (this project is on three ^0.186)
           always uses physically-correct light units — there's no more
           "legacy" mode. Old-style demo intensities like
           ambientLight=0.6 / directionalLight=1 are calibrated for the
           pre-physical model and render extremely dim under the physical
           one — dim enough that, against a near-black background like
           #0b1220, objects were effectively invisible even though they
           were technically rendering. Fix: use intensities appropriate
           for physically-correct lighting (a bright hemisphere fill +
           much stronger key light) and set the scene background
           explicitly on the canvas itself rather than relying only on
           the wrapping div's CSS background.
      */}
      <div ref={measureRef} className="flex-1 relative" style={{ background: bg }}>
        {ready && (
          <Canvas
            key={`${Math.round(size.width)}x${Math.round(size.height)}-init`}
            style={{ width: '100%', height: '100%' }}
            camera={{ position: spec.camera_position ?? [0, 2, 6], fov: 50 }}
          >
            <color attach="background" args={[bg]} />
            <hemisphereLight intensity={1.2} groundColor="#1e293b" color="#e2e8f0" />
            <ambientLight intensity={1.5} />
            <directionalLight position={[5, 8, 5]} intensity={3.5} />
            <directionalLight position={[-5, -3, -5]} intensity={1} />
            {objects.map((obj) => (
              <SceneObject key={obj.id} obj={obj} assetUrls={assetUrls} />
            ))}
            <ContactShadows opacity={0.3} scale={10} blur={2} far={4} />
            <OrbitControls autoRotate={spec.auto_rotate} enableDamping />
          </Canvas>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            Preparing scene…
          </div>
        )}
      </div>
    </div>
  );
}