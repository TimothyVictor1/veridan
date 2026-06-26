import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Float, Line } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";

const MODEL_URL = "/human-model.fbx";
const TARGET_HEIGHT = 3.62;

const PALETTES = {
  scanning: { body: "#dbe7ec", glow: "#0ea5e9", soft: "#dff7ff", core: "#0284c7", anomaly: "#38bdf8", risk: "#fb7185", rgb: [0.54, 0.82, 0.94] },
  ready: { body: "#e8eef2", glow: "#38bdf8", soft: "#effbff", core: "#0891b2", anomaly: "#22d3ee", risk: "#fb7185", rgb: [0.58, 0.83, 0.93] },
  testing: { body: "#edf7fb", glow: "#38bdf8", soft: "#ecfeff", core: "#0ea5e9", anomaly: "#67e8f9", risk: "#fb7185", rgb: [0.72, 0.88, 0.95] },
  passed: { body: "#e6f5ee", glow: "#10b981", soft: "#ecfdf5", core: "#059669", anomaly: "#22c55e", rgb: [0.56, 0.86, 0.72] },
  failed: { body: "#fff1f2", glow: "#ef4444", soft: "#fee2e2", core: "#be123c", anomaly: "#dc2626", rgb: [0.86, 0.42, 0.44] },
};

const SPINE = [[0, 0.18, 0.03], [0, 0.7, 0.03], [0, 1.22, 0.04], [0, 1.78, 0.05], [0, 2.35, 0.04], [0, 2.86, 0.03], [0, 3.22, 0.02]];
const SHOULDER = [[-0.45, 2.66, 0.02], [-0.22, 2.74, 0.04], [0, 2.72, 0.05], [0.22, 2.74, 0.04], [0.45, 2.66, 0.02]];
const PELVIS = [[-0.28, 1.18, 0.02], [0, 1.06, 0.04], [0.28, 1.18, 0.02]];
const RIBS = [
  [[-0.31, 2.42, 0.05], [-0.12, 2.5, 0.14], [0, 2.48, 0.16], [0.12, 2.5, 0.14], [0.31, 2.42, 0.05]],
  [[-0.36, 2.25, 0.04], [-0.15, 2.34, 0.16], [0, 2.32, 0.18], [0.15, 2.34, 0.16], [0.36, 2.25, 0.04]],
  [[-0.34, 2.08, 0.04], [-0.14, 2.16, 0.14], [0, 2.14, 0.16], [0.14, 2.16, 0.14], [0.34, 2.08, 0.04]],
];

function paletteFor(phase) {
  return PALETTES[phase] || PALETTES.ready;
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function modelTransform(source, targetHeight = TARGET_HEIGHT) {
  source.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(source);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 1);
  return { box, center, scale: targetHeight / height };
}

function normalizeLayer(source, material, renderOrder = 0) {
  const { box, center, scale } = modelTransform(source);
  const clone = source.clone(true);

  clone.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = false;
      child.renderOrder = renderOrder;
    }
  });

  clone.scale.setScalar(scale);
  clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  return clone;
}

function createSurfacePointGeometry(source, maxPoints = 7200) {
  const { box, center, scale } = modelTransform(source);
  const vectors = [];
  let total = 0;

  source.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    total += child.geometry.attributes.position.count;
  });

  const stride = Math.max(1, Math.ceil(total / maxPoints));
  source.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    const position = child.geometry.attributes.position;
    const point = new THREE.Vector3();
    child.updateWorldMatrix(true, false);

    for (let index = 0; index < position.count; index += stride) {
      point.fromBufferAttribute(position, index).applyMatrix4(child.matrixWorld);
      vectors.push((point.x - center.x) * scale, (point.y - box.min.y) * scale, (point.z - center.z) * scale);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vectors, 3));
  return geometry;
}

function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#dfe9ee",
    emissive: "#7dd3fc",
    emissiveIntensity: 0.11,
    metalness: 0.18,
    roughness: 0.16,
    transmission: 0.22,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function createTwinShaderMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Vector3(0.04, 0.52, 0.62) },
      uOpacity: { value: 0.28 },
      uGlitch: { value: 0 },
      uScan: { value: 1 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      uniform float uTime;
      uniform float uGlitch;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec3 pos = position;
        pos *= 1.0 + sin(uTime * 1.1) * 0.0022;
        if (uGlitch > 0.5) {
          pos.x += sin(pos.y * 42.0 + uTime * 34.0) * 0.008;
        }
        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uScan;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.05);
        float scanY = fract(vWorldPosition.y * 0.34 - uTime * 0.5);
        float scanLine = smoothstep(0.0, 0.016, scanY) * smoothstep(0.052, 0.016, scanY) * uScan;
        float contours = abs(sin(vWorldPosition.y * 90.0)) * 0.065;
        float alpha = clamp(fresnel * uOpacity + scanLine * 0.28 + contours, 0.0, 0.82);
        vec3 color = uColor * (0.62 + fresnel * 1.7) + scanLine * vec3(0.9, 1.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

function HumanDigitalTwin({ phase }) {
  const groupRef = useRef();
  const glassRef = useRef();
  const shaderRef = useRef();
  const wireRef = useRef();
  const pointRef = useRef();
  const model = useLoader(FBXLoader, MODEL_URL);

  const { glassLayer, scanLayer, wireLayer, pointGeometry } = useMemo(() => {
    const glassMaterial = createGlassMaterial();
    const shaderMaterial = createTwinShaderMaterial();
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: "#38bdf8",
      wireframe: true,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    glassRef.current = glassMaterial;
    shaderRef.current = shaderMaterial;
    wireRef.current = wireMaterial;
    return {
      glassLayer: normalizeLayer(model, glassMaterial, 1),
      scanLayer: normalizeLayer(model, shaderMaterial, 2),
      wireLayer: normalizeLayer(model, wireMaterial, 3),
      pointGeometry: createSurfacePointGeometry(model),
    };
  }, [model]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const palette = paletteFor(phase);

    if (groupRef.current) {
      groupRef.current.rotation.y = time * (phase === "testing" ? 0.46 : 0.31);
      groupRef.current.position.y = Math.sin(time * 0.72) * 0.024;
      groupRef.current.position.x = phase === "failed" ? Math.sin(time * 18) * 0.012 : 0;
    }

    if (glassRef.current) {
      glassRef.current.color.lerp(new THREE.Color(phase === "failed" ? "#fff1f2" : palette.body), 0.05);
      glassRef.current.emissive.lerp(new THREE.Color(palette.glow), 0.05);
      glassRef.current.opacity = phase === "passed" ? 0.28 : phase === "testing" ? 0.36 : 0.32;
    }

    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = time;
      shaderRef.current.uniforms.uColor.value.lerp(new THREE.Vector3(...palette.rgb), 0.05);
      shaderRef.current.uniforms.uOpacity.value = phase === "passed" ? 0.22 : phase === "failed" ? 0.31 : 0.29;
      shaderRef.current.uniforms.uGlitch.value = phase === "testing" && Math.sin(time * 10.5) > 0.84 ? 1 : 0;
      shaderRef.current.uniforms.uScan.value = phase === "scanning" || phase === "testing" ? 1 : 0;
    }


    if (wireRef.current) {
      wireRef.current.color.lerp(new THREE.Color(palette.glow), 0.05);
      wireRef.current.opacity = phase === "testing" ? 0.09 : phase === "ready" ? 0.06 : 0.052;
    }

    if (pointRef.current) {
      pointRef.current.material.color.lerp(new THREE.Color(palette.soft), 0.05);
      pointRef.current.material.opacity = phase === "ready" ? 0.26 : phase === "testing" ? 0.5 : 0.34;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.02, 0]}>
      <primitive object={glassLayer} />
      <primitive object={scanLayer} />
      <primitive object={wireLayer} />
      <points ref={pointRef} geometry={pointGeometry}>
        <pointsMaterial color="#dff6ff" opacity={0.34} size={0.0105} sizeAttenuation transparent depthWrite={false} />
      </points>
    </group>
  );
}

function createOrbitPoints(count) {
  const random = seededRandom(87);
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 0.72 + random() * 0.72;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = 0.1 + random() * 3.44;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
    speeds[index] = 0.45 + random() * 0.75;
  }

  return { positions, speeds };
}

function NanobotParticles({ phase, count = 280 }) {
  const ref = useRef();
  const { positions, speeds } = useMemo(() => createOrbitPoints(count), [count]);
  const geometry = useMemo(() => {
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return particleGeometry;
  }, [positions]);

  useFrame(() => {
    if (!ref.current) return;
    const attr = ref.current.geometry.attributes.position;
    const data = attr.array;
    const speed = phase === "testing" ? 1.75 : 1;

    for (let index = 0; index < speeds.length; index += 1) {
      const offset = index * 3;
      const x = data[offset];
      const z = data[offset + 2];
      const radius = Math.sqrt(x * x + z * z);
      const angle = Math.atan2(z, x) + 0.01 * speed * speeds[index];
      let y = data[offset + 1] + 0.0058 * speed * speeds[index];
      if (y > 3.58) y = 0.08;
      data[offset] = Math.cos(angle) * radius;
      data[offset + 1] = y;
      data[offset + 2] = Math.sin(angle) * radius;
    }

    attr.needsUpdate = true;
  });

  const palette = paletteFor(phase);
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color={palette.soft} opacity={0.62} size={0.018} sizeAttenuation transparent depthWrite={false} />
    </points>
  );
}

function TreatmentStream({ phase }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const random = seededRandom(122);
    const data = new Float32Array(104 * 3);
    for (let index = 0; index < 104; index += 1) {
      data[index * 3] = -2.15 - random() * 0.5;
      data[index * 3 + 1] = 1.7 + random() * 0.92;
      data[index * 3 + 2] = -0.12 + random() * 0.24;
    }
    return data;
  }, []);

  const geometry = useMemo(() => {
    const streamGeometry = new THREE.BufferGeometry();
    streamGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return streamGeometry;
  }, [positions]);

  useFrame((state) => {
    if (!ref.current || phase !== "testing") return;
    const attr = ref.current.geometry.attributes.position;
    const data = attr.array;
    const time = state.clock.elapsedTime;

    for (let index = 0; index < attr.count; index += 1) {
      const offset = index * 3;
      let x = data[offset] + 0.04 + (index % 7) * 0.001;
      if (x > 0.22) x = -2.16 - (index % 9) * 0.036;
      data[offset] = x;
      data[offset + 1] = 1.7 + Math.sin(time * 2.5 + index * 0.14) * 0.36 + (index % 6) * 0.03;
      data[offset + 2] = 0.16 + Math.cos(time * 3.4 + index) * 0.16;
    }

    attr.needsUpdate = true;
  });

  if (phase !== "testing") return null;

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#06b6d4" opacity={0.9} size={0.026} sizeAttenuation transparent depthWrite={false} />
    </points>
  );
}

function AnomalyMarker({ phase, disease }) {
  const groupRef = useRef();
  const palette = paletteFor(phase);
  const marker = disease?.marker || [0.09, 2.2, 0.22];

  useFrame((state) => {
    if (!groupRef.current) return;
    if (phase !== "testing") {
      groupRef.current.scale.setScalar(1);
      groupRef.current.rotation.z = 0;
      return;
    }
    const time = state.clock.elapsedTime;
    groupRef.current.scale.setScalar(1 + Math.sin(time * 7) * 0.18);
    groupRef.current.rotation.z = time * 0.35;
  });

  if (phase === "scanning") return null;

  const signalColor = phase === "failed" ? palette.anomaly : phase === "passed" ? "#22c55e" : palette.risk || "#fb7185";
  const haloColor = phase === "failed" ? "#fecdd3" : phase === "passed" ? "#86efac" : palette.anomaly;
  const opacity = phase === "passed" ? 0.16 : phase === "failed" ? 0.4 : 0.3;

  return (
    <group ref={groupRef} position={marker}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.0035, 8, 64]} />
        <meshBasicMaterial color={signalColor} opacity={phase === "passed" ? 0.18 : 0.56} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[Math.PI / 2.5, 0.32, 0.1]}>
        <torusGeometry args={[0.2, 0.0026, 8, 72]} />
        <meshBasicMaterial color={haloColor} opacity={opacity} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[Math.PI / 3, -0.44, 0.2]}>
        <torusGeometry args={[0.29, 0.002, 8, 88]} />
        <meshBasicMaterial color={haloColor} opacity={phase === "passed" ? 0.08 : 0.18} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[0.2, 0.6, 0]}>
        <ringGeometry args={[0.035, 0.048, 40]} />
        <meshBasicMaterial color="#ffffff" opacity={phase === "passed" ? 0.12 : 0.42} transparent side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function AnatomicalGuides({ phase }) {
  const palette = paletteFor(phase);
  const lineProps = { color: palette.core, transparent: true };

  return (
    <group>
      <Line points={SPINE} {...lineProps} lineWidth={1.3} opacity={0.32} />
      <Line points={SHOULDER} {...lineProps} lineWidth={1.1} opacity={0.28} />
      <Line points={PELVIS} {...lineProps} lineWidth={1} opacity={0.24} />
      {RIBS.map((rib, index) => (
        <Line key={index} points={rib} {...lineProps} lineWidth={0.8} opacity={0.18} />
      ))}
      <mesh position={[-0.14, 2.24, 0.1]} scale={[0.78, 1.18, 0.38]}>
        <sphereGeometry args={[0.19, 24, 16]} />
        <meshBasicMaterial color={palette.core} opacity={0.05} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0.14, 2.24, 0.1]} scale={[0.78, 1.18, 0.38]}>
        <sphereGeometry args={[0.19, 24, 16]} />
        <meshBasicMaterial color={palette.core} opacity={0.05} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function ProjectionBase({ phase }) {
  const ringA = useRef();
  const ringB = useRef();
  const ringC = useRef();
  const palette = paletteFor(phase);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (ringA.current) ringA.current.rotation.z = time * 0.3;
    if (ringB.current) ringB.current.rotation.z = -time * 0.22;
    if (ringC.current) ringC.current.rotation.z = time * 0.13;
  });

  return (
    <group position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={ringA}>
        <torusGeometry args={[0.92, 0.006, 8, 72]} />
        <meshBasicMaterial color={palette.glow} opacity={0.43} transparent depthWrite={false} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[0.68, 0.004, 8, 64]} />
        <meshBasicMaterial color="#7dd3fc" opacity={0.16} transparent depthWrite={false} />
      </mesh>
      <mesh ref={ringC}>
        <torusGeometry args={[0.44, 0.003, 8, 72]} />
        <meshBasicMaterial color="#94a3b8" opacity={0.12} transparent depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[1, 72]} />
        <meshBasicMaterial color={palette.soft} opacity={0.11} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ScanSlice({ active, phase }) {
  const ref = useRef();
  const palette = paletteFor(phase);

  useFrame((state) => {
    if (!ref.current || !active) return;
    const time = state.clock.elapsedTime;
    ref.current.position.y = 0.1 + ((time * 0.64) % 3.42);
    ref.current.material.opacity = 0.2 + Math.sin(time * 6.4) * 0.08;
  });

  if (!active) return null;

  return (
    <mesh ref={ref} position={[0, 1, 0.3]}>
      <planeGeometry args={[2.2, 0.054]} />
      <meshBasicMaterial color={palette.soft} opacity={0.22} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function ChamberGuides({ phase }) {
  const palette = paletteFor(phase);
  return (
    <group>
      <mesh position={[0, 1.78, 0]}>
        <cylinderGeometry args={[0.002, 0.7, 3.58, 16, 1, true]} />
        <meshBasicMaterial color={palette.soft} opacity={0.045} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[0.56, 1.36, 2.16, 2.96, 3.48].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.76, 0.0025, 6, 60]} />
          <meshBasicMaterial color={palette.glow} opacity={0.1} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function LoadingFallback() {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 1.8;
  });

  return (
    <mesh ref={ref} position={[0, 1.72, 0]}>
      <torusGeometry args={[0.34, 0.018, 8, 48]} />
      <meshBasicMaterial color="#38bdf8" opacity={0.44} transparent depthWrite={false} />
    </mesh>
  );
}

function CameraAim() {
  const { camera } = useThree();
  useFrame(() => {
    camera.lookAt(0, 0.42, 0);
  });
  return null;
}

function Scene({ phase, patient }) {
  const isGenerating = phase === "scanning";
  const isTesting = phase === "testing";
  const disease = patient?.disease;

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[2.4, 4.4, 4.2]} intensity={0.65} color="#ffffff" />
      <pointLight position={[-2.2, 2.2, 3.4]} intensity={0.64} color="#dff6ff" />
      <pointLight position={[1.8, 0.2, 2.2]} intensity={0.34} color="#bae6fd" />

      <group position={[0, -1.34, 0]}>
        <group position={[0, -0.06, 0]} scale={[0.96, 0.96, 0.96]}>
          <Float speed={0.62} rotationIntensity={0} floatIntensity={isGenerating || isTesting ? 0.08 : 0} floatingRange={[-0.02, 0.02]}>
            <Suspense fallback={<LoadingFallback />}>
              <HumanDigitalTwin phase={phase} />
            </Suspense>
            <AnatomicalGuides phase={phase} />
            <AnomalyMarker phase={phase} disease={disease} />
          </Float>
        </group>

        {(isGenerating || isTesting) && <ChamberGuides phase={phase} />}
        {isGenerating && <NanobotParticles phase={phase} />}
        <TreatmentStream phase={phase} />
        {(isGenerating || isTesting) && <ProjectionBase phase={phase} />}
        <ScanSlice active={isGenerating} phase={phase} />
      </group>
    </>
  );
}

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="canvas-error">3D scene unavailable. Refresh to retry.</div>;
    }
    return this.props.children;
  }
}

export default function HolographicBodyScene({ phase, patient }) {
  return (
    <CanvasErrorBoundary>
      <Canvas
        camera={{ position: [0, 1.18, 7.35], fov: 40 }}
        dpr={[1, 1.2]}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false, stencil: false }}
        style={{ background: "transparent" }}
      >
        <CameraAim />
        <Scene phase={phase} patient={patient} />
        {(phase === "testing" || phase === "passed" || phase === "failed") && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={phase === "testing" ? 0.22 : 0.16} luminanceThreshold={0.16} luminanceSmoothing={0.72} />
          </EffectComposer>
        )}
      </Canvas>
    </CanvasErrorBoundary>
  );
}
