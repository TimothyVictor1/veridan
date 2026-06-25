import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Float, Line } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";

const MODEL_URL = "/human-model.fbx";
const TARGET_HEIGHT = 3.62;

const PALETTES = {
  scanning: { body: "#78909a", glow: "#ff7a1a", soft: "#ffd2b5", core: "#f97316", anomaly: "#ff4f1a", rgb: [0.45, 0.56, 0.6] },
  ready: { body: "#7f949d", glow: "#fb6a16", soft: "#ffc9ad", core: "#ea580c", anomaly: "#ff5a1f", rgb: [0.48, 0.57, 0.6] },
  testing: { body: "#f97316", glow: "#fb5b12", soft: "#fed7aa", core: "#111111", anomaly: "#ff3d16", rgb: [0.9, 0.3, 0.08] },
  passed: { body: "#ea580c", glow: "#fb923c", soft: "#ffedd5", core: "#111111", anomaly: "#f97316", rgb: [0.82, 0.26, 0.05] },
  failed: { body: "#b91c1c", glow: "#ef4444", soft: "#fecaca", core: "#111111", anomaly: "#dc2626", rgb: [0.72, 0.12, 0.1] },
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

function createSurfacePointGeometry(source, maxPoints = 12000) {
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
    color: "#d8e1e3",
    emissive: "#fb6a16",
    emissiveIntensity: 0.12,
    metalness: 0.03,
    roughness: 0.22,
    transmission: 0.18,
    transparent: true,
    opacity: 0.24,
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

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.05);
        float scanY = fract(vWorldPosition.y * 0.34 - uTime * 0.5);
        float scanLine = smoothstep(0.0, 0.016, scanY) * smoothstep(0.052, 0.016, scanY);
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
      color: "#fb6a16",
      wireframe: true,
      transparent: true,
      opacity: 0.06,
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
      glassRef.current.color.lerp(new THREE.Color(phase === "failed" ? "#ffe0dc" : "#d8e1e3"), 0.05);
      glassRef.current.emissive.lerp(new THREE.Color(palette.glow), 0.05);
      glassRef.current.opacity = phase === "passed" ? 0.2 : phase === "testing" ? 0.27 : 0.24;
    }

    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = time;
      shaderRef.current.uniforms.uColor.value.lerp(new THREE.Vector3(...palette.rgb), 0.05);
      shaderRef.current.uniforms.uOpacity.value = phase === "passed" ? 0.22 : phase === "failed" ? 0.31 : 0.29;
      shaderRef.current.uniforms.uGlitch.value = phase === "testing" && Math.sin(time * 10.5) > 0.84 ? 1 : 0;
    }

    if (wireRef.current) {
      wireRef.current.color.lerp(new THREE.Color(palette.glow), 0.05);
      wireRef.current.opacity = phase === "testing" ? 0.09 : 0.058;
    }

    if (pointRef.current) {
      pointRef.current.material.color.lerp(new THREE.Color(palette.soft), 0.05);
      pointRef.current.material.opacity = phase === "testing" ? 0.52 : 0.36;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.02, 0]}>
      <primitive object={glassLayer} />
      <primitive object={scanLayer} />
      <primitive object={wireLayer} />
      <points ref={pointRef} geometry={pointGeometry}>
        <pointsMaterial color="#ffd2b5" opacity={0.36} size={0.011} sizeAttenuation transparent depthWrite={false} />
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

function NanobotParticles({ phase, count = 620 }) {
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
    const speed = phase === "testing" ? 1.75 : 1;

    for (let index = 0; index < speeds.length; index += 1) {
      const x = attr.getX(index);
      const z = attr.getZ(index);
      const radius = Math.sqrt(x * x + z * z);
      const angle = Math.atan2(z, x) + 0.01 * speed * speeds[index];
      let y = attr.getY(index) + 0.0058 * speed * speeds[index];
      if (y > 3.58) y = 0.08;
      attr.setXYZ(index, Math.cos(angle) * radius, y, Math.sin(angle) * radius);
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
    const data = new Float32Array(240 * 3);
    for (let index = 0; index < 240; index += 1) {
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
    const time = state.clock.elapsedTime;

    for (let index = 0; index < attr.count; index += 1) {
      let x = attr.getX(index) + 0.04 + (index % 7) * 0.001;
      if (x > 0.22) x = -2.16 - (index % 9) * 0.036;
      const y = 1.7 + Math.sin(time * 2.5 + index * 0.14) * 0.36 + (index % 6) * 0.03;
      const z = 0.16 + Math.cos(time * 3.4 + index) * 0.16;
      attr.setXYZ(index, x, y, z);
    }

    attr.needsUpdate = true;
  });

  if (phase !== "testing") return null;

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#fb5b12" opacity={0.9} size={0.026} sizeAttenuation transparent depthWrite={false} />
    </points>
  );
}

function AnomalyMarker({ phase }) {
  const groupRef = useRef();
  const palette = paletteFor(phase);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    groupRef.current.scale.setScalar(1 + Math.sin(time * (phase === "testing" ? 7 : 3.2)) * 0.18);
    groupRef.current.rotation.z = time * 0.35;
  });

  return (
    <group ref={groupRef} position={[0.09, 2.2, 0.22]}>
      <mesh>
        <sphereGeometry args={[0.105, 20, 20]} />
        <meshBasicMaterial color={palette.anomaly} opacity={phase === "passed" ? 0.2 : 0.48} transparent depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.17, 0.005, 8, 56]} />
        <meshBasicMaterial color={palette.anomaly} opacity={phase === "passed" ? 0.18 : 0.5} transparent depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 3, 0.3, 0]}>
        <torusGeometry args={[0.27, 0.003, 8, 64]} />
        <meshBasicMaterial color={palette.anomaly} opacity={phase === "passed" ? 0.08 : 0.24} transparent depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.34, 18, 18]} />
        <meshBasicMaterial color={palette.anomaly} opacity={phase === "passed" ? 0.03 : 0.075} transparent depthWrite={false} />
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
        <torusGeometry args={[0.92, 0.006, 8, 104]} />
        <meshBasicMaterial color={palette.glow} opacity={0.43} transparent depthWrite={false} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[0.68, 0.004, 8, 86]} />
        <meshBasicMaterial color="#fb923c" opacity={0.2} transparent depthWrite={false} />
      </mesh>
      <mesh ref={ringC}>
        <torusGeometry args={[0.44, 0.003, 8, 72]} />
        <meshBasicMaterial color="#8a817a" opacity={0.16} transparent depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[1, 104]} />
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

function DataHelix({ phase }) {
  const ref = useRef();
  const palette = paletteFor(phase);
  const count = 158;

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const theta = (index / count) * Math.PI * 7;
      positions[index * 3] = Math.cos(theta) * 1.12;
      positions[index * 3 + 1] = 0.1 + (index / count) * 3.42;
      positions[index * 3 + 2] = Math.sin(theta) * 1.12;
    }
    const helixGeometry = new THREE.BufferGeometry();
    helixGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return helixGeometry;
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.12;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color={palette.glow} opacity={0.24} size={0.014} sizeAttenuation transparent depthWrite={false} />
    </points>
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
          <torusGeometry args={[0.76, 0.0025, 6, 78]} />
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
      <meshBasicMaterial color="#fb6a16" opacity={0.44} transparent depthWrite={false} />
    </mesh>
  );
}

function Scene({ phase }) {
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[2.4, 4.4, 4.2]} intensity={0.65} color="#ffffff" />
      <pointLight position={[-2.2, 2.2, 3.4]} intensity={0.64} color="#ffd2b5" />
      <pointLight position={[1.8, 0.2, 2.2]} intensity={0.34} color="#fbbf24" />

      <group position={[0, -1.05, 0]}>
        <group position={[0, -0.1, 0]} scale={[0.82, 0.82, 0.82]}>
          <Float speed={0.62} rotationIntensity={0} floatIntensity={0.11} floatingRange={[-0.03, 0.03]}>
            <Suspense fallback={<LoadingFallback />}>
              <HumanDigitalTwin phase={phase} />
            </Suspense>
            <AnatomicalGuides phase={phase} />
            <AnomalyMarker phase={phase} />
          </Float>
        </group>

        <ChamberGuides phase={phase} />
        <NanobotParticles phase={phase} />
        <DataHelix phase={phase} />
        <TreatmentStream phase={phase} />
        <ProjectionBase phase={phase} />
        <ScanSlice active={phase === "scanning"} phase={phase} />
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

export default function HolographicBodyScene({ phase }) {
  return (
    <CanvasErrorBoundary>
      <Canvas
        camera={{ position: [0, 1.84, 8.65], fov: 38 }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: true }}
        style={{ background: "transparent" }}
      >
        <Scene phase={phase} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.25} luminanceThreshold={0.14} luminanceSmoothing={0.76} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </CanvasErrorBoundary>
  );
}