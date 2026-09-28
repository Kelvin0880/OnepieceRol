import { OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CatmullRomCurve3, Color, DoubleSide, Group, MeshStandardMaterial, Shape, ShapeGeometry, ShaderMaterial, SphereGeometry, TubeGeometry, Vector3 } from "three";

/** The swirls of a devil fruit: the sphere is tiled with spirals around evenly spread (Fibonacci) centres. */
const fragmentShader = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vWorld;
const int CELLS = 24;
vec3 fib(int i) {
  float k = float(i) + 0.5;
  float phi = acos(1.0 - 2.0 * k / float(CELLS));
  float th = 3.14159265 * (1.0 + sqrt(5.0)) * k;
  return vec3(cos(th) * sin(phi), cos(phi), sin(th) * sin(phi));
}
void main() {
  vec3 p = normalize(vObj);
  float best = 10.0;
  vec3 c = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < CELLS; i++) {
    vec3 q = fib(i);
    float d = distance(p, q);
    if (d < best) { best = d; c = q; }
  }
  vec3 t = normalize(cross(c, abs(c.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(c, t);
  vec3 rel = p - c;
  float ang = atan(dot(rel, b), dot(rel, t));
  float spiral = fract(ang / 6.28318 + length(rel) * 9.5);
  float band = smoothstep(0.02, 0.1, spiral) * smoothstep(0.5, 0.36, spiral);
  vec3 col = mix(uB, uA, band);
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 l = normalize(vec3(0.6, 0.9, 0.7));
  float diff = max(dot(n, l), 0.0);
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), 70.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col = col * (0.3 + 0.85 * diff) + vec3(1.0, 0.97, 0.9) * spec * 0.9 + uA * fres * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const vertexShader = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vObj = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

function fruitGeometry(): SphereGeometry {
  const g = new SphereGeometry(1.2, 96, 64);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const top = Math.max(0, (y / 1.2 - 0.82) / 0.18);
    const bottom = Math.max(0, (-y / 1.2 - 0.9) / 0.1);
    pos.setXYZ(i, x * 1.02, y * 0.93 - top * top * 0.22 + bottom * 0.05, z * 1.02);
  }
  g.computeVertexNormals();
  return g;
}

function leafShape(): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.25, 0.18, 0.62, 0.2, 0.9, 0);
  s.bezierCurveTo(0.62, -0.16, 0.25, -0.14, 0, 0);
  return s;
}

function Fruit({ colors }: { colors: [string, string] }) {
  const group = useRef<Group>(null);
  const spin = useRef(0);
  const target = useMemo(() => ({ a: new Color(), b: new Color() }), []);
  const built = useMemo(() => {
    const material = new ShaderMaterial({ uniforms: { uA: { value: new Color(colors[0]) }, uB: { value: new Color(colors[1]) }, uTime: { value: 0 } }, vertexShader, fragmentShader });
    const stemCurve = new CatmullRomCurve3([new Vector3(0, 0.8, 0), new Vector3(0.05, 1.2, 0.02), new Vector3(0.22, 1.5, 0.06), new Vector3(0.5, 1.62, 0.1)]);
    return {
      material,
      body: fruitGeometry(),
      stem: new TubeGeometry(stemCurve, 24, 0.075, 8, false),
      leaf: new ShapeGeometry(leafShape(), 12),
      stemMat: new MeshStandardMaterial({ color: "#3d5a24", roughness: 0.7 }),
      leafMat: new MeshStandardMaterial({ color: "#4f8a2d", roughness: 0.6, side: DoubleSide }),
    };
  }, []);
  useEffect(() => () => [built.material, built.body, built.stem, built.leaf, built.stemMat, built.leafMat].forEach((x) => x.dispose()), [built]);
  useEffect(() => {
    target.a.set(colors[0]);
    target.b.set(colors[1]);
    spin.current = 9;
  }, [colors, target]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    (built.material.uniforms.uA.value as Color).lerp(target.a, 1 - Math.exp(-dt * 5));
    (built.material.uniforms.uB.value as Color).lerp(target.b, 1 - Math.exp(-dt * 5));
    spin.current *= Math.exp(-dt * 2.2);
    if (group.current) {
      group.current.rotation.y += dt * (0.45 + spin.current);
      group.current.position.y = Math.sin(performance.now() / 900) * 0.08;
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={built.body} material={built.material} />
      <mesh geometry={built.stem} material={built.stemMat} />
      <mesh geometry={built.leaf} material={built.leafMat} position={[0.4, 1.58, 0.1]} rotation={[0.3, -0.4, 0.5]} scale={1.1} />
    </group>
  );
}

export default function FruitCanvas({ colors, active, interactive }: { colors: [string, string]; active: boolean; interactive: boolean }) {
  return (
    <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.75]} camera={{ fov: 30, position: [0, 0.35, 7.2] }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={2.4} />
      <Fruit colors={colors} />
      <Sparkles count={40} scale={[5, 4, 3]} size={4} speed={0.5} color={colors[0]} opacity={0.8} />
      {interactive && <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.6} minPolarAngle={Math.PI / 3} maxPolarAngle={(2 * Math.PI) / 3} />}
    </Canvas>
  );
}
