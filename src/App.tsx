import { Canvas, useThree } from "@react-three/fiber";
import { Billboard, ContactShadows, Edges, Environment, Grid, Line, OrbitControls, Text } from "@react-three/drei";
import {
  Download,
  FileText,
  Flame,
  Info,
  Layers,
  Menu,
  Ruler,
  ShieldAlert,
  Snowflake,
  Weight,
  Wind,
  X
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { buildModel, colors, modelMetrics, partPoints, PartSpec, Point3, SCALE, toScenePoint, toSceneVector, typeLabels } from "./model";

type LoadMode = "none" | "dead" | "snow" | "wind" | "all";
type ViewPreset = "iso" | "top" | "front" | "side" | "braceA" | "braceB" | "ridge" | "ties" | "supports";

type Selection = {
  name: string;
  type: string;
  material?: string;
  dimensions?: string;
  note?: string;
};

type CameraApi = {
  setPreset: (preset: ViewPreset) => void;
};

const loadCopy: Record<LoadMode, { title: string; value: string; note: string; technical: string; color: string }> = {
  none: {
    title: "Bez warstwy obciążeń",
    value: "Czysty model konstrukcji",
    note: "",
    technical: "Brak strzałek sił.",
    color: "#dbe7f6"
  },
  dead: {
    title: "Ciężar pokrycia",
    value: "Dach stale dociska krokwie, jętki, wieniec i słupy.",
    note: "Strzałki pokazują obciążenie działające cały czas po wykonaniu OSB, papy i gontu.",
    technical: "Roboczo: ok. 0,242 kN/m² dla OSB18 + papa + gont.",
    color: "#f4b24d"
  },
  snow: {
    title: "Śnieg na dachu",
    value: "Śnieg dokłada duży, równomierny nacisk na obie połacie.",
    note: "To tryb do pokazania, gdzie dach i podpory dostają największe pionowe dociążenie zimą.",
    technical: "Roboczo: śnieg ciężki 1,28 kN/m², wariant bardzo ciężki 1,60 kN/m².",
    color: "#72d7ff"
  },
  wind: {
    title: "Wiatr i podrywanie",
    value: "Wiatr pcha konstrukcję z boku i może próbować podrywać dach.",
    note: "Pokazane są główne kierunki działania wiatru na konstrukcję i dach.",
    technical: "Roboczo: wiatr poziomy SW 8-10 kN, ssanie 0,8-1,0 kN/m².",
    color: "#a889ff"
  },
  all: {
    title: "Obciążenia razem",
    value: "Pokrycie, śnieg i wiatr pokazane jednocześnie jako mapa ryzyk.",
    note: "Dół oznacza dociążenie, bok oznacza napór, góra oznacza podrywanie.",
    technical: "Wartości są poglądowe i służą do prezentacji kierunków działania sił.",
    color: "#9fe2b8"
  }
};

const viewLabels: Record<ViewPreset, string> = {
  iso: "3D",
  top: "Rzut",
  front: "Front",
  side: "Bok",
  braceA: "Zastrzały A",
  braceB: "Zastrzały B",
  ridge: "Kalenica",
  ties: "Jętki",
  supports: "Podpory"
};

const viewShortLabels: Record<ViewPreset, string> = {
  iso: "3D",
  top: "G",
  front: "F",
  side: "b",
  braceA: "A",
  braceB: "B",
  ridge: "K",
  ties: "J",
  supports: "P"
};

function createPrismGeometry(part: Extract<PartSpec["geometry"], { kind: "prism" }>) {
  const base = part.base.map((point) => new THREE.Vector3(...toScenePoint(point)));
  const extrusion = new THREE.Vector3(...toSceneVector(part.extrusion));
  const top = base.map((point) => point.clone().add(extrusion));
  const vertices = [...base, ...top];
  const indices: number[] = [];
  const n = base.length;

  for (let i = 1; i < n - 1; i += 1) {
    indices.push(0, i, i + 1);
    indices.push(n, n + i + 1, n + i);
  }

  for (let i = 0; i < n; i += 1) {
    const next = (i + 1) % n;
    indices.push(i, next, n + next);
    indices.push(i, n + next, n + i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function createRoofSurface(side: "left" | "right", zOffset: number) {
  const y0 = 0;
  const y1 = modelMetrics.roofLength;
  const xL = -modelMetrics.overhangEachSideX;
  const xC = modelMetrics.width / 2;
  const xR = modelMetrics.width + modelMetrics.overhangEachSideX;
  const eaveZ = modelMetrics.eaveZ + zOffset;
  const ridgeZ = modelMetrics.ridgeZ + zOffset;
  const points: Point3[] =
    side === "left"
      ? [
          [xL, y0, eaveZ],
          [xL, y1, eaveZ],
          [xC, y1, ridgeZ],
          [xC, y0, ridgeZ]
        ]
      : [
          [xC, y0, ridgeZ],
          [xC, y1, ridgeZ],
          [xR, y1, eaveZ],
          [xR, y0, eaveZ]
        ];

  const vertices = points.map((point) => scenePoint(point));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((point) => [point.x, point.y, point.z]), 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function scenePoint(point: Point3) {
  return new THREE.Vector3(...toScenePoint(point));
}

function ToggleButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`toggle ${active ? "is-active" : ""}`} type="button" aria-pressed={active} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function dimensionsForPart(part: PartSpec) {
  if (part.geometry.kind === "box") {
    const [dx, dy, dz] = part.geometry.size;
    return `Wymiary: ${dx.toFixed(1)} × ${dy.toFixed(1)} × ${dz.toFixed(1)} cm`;
  }

  const points = partPoints(part);
  const min: Point3 = [Infinity, Infinity, Infinity];
  const max: Point3 = [-Infinity, -Infinity, -Infinity];
  points.forEach((point) => {
    point.forEach((value, index) => {
      min[index] = Math.min(min[index], value);
      max[index] = Math.max(max[index], value);
    });
  });
  const dims = max.map((value, index) => value - min[index]);
  return `Obrys: ${dims[0].toFixed(1)} × ${dims[1].toFixed(1)} × ${dims[2].toFixed(1)} cm`;
}

function PartMesh({ part, selected, onSelect }: { part: PartSpec; selected: boolean; onSelect: (selection: Selection) => void }) {
  const prismGeometry = useMemo(() => {
    if (part.geometry.kind !== "prism") return null;
    return createPrismGeometry(part.geometry);
  }, [part.geometry]);

  const materialProps = {
    color: colors[part.type],
    roughness: part.type === "metal" ? 0.34 : 0.62,
    metalness: part.type === "metal" ? 0.45 : 0.02,
    transparent: Boolean(part.transparent),
    opacity: part.opacity ?? 1,
    side: THREE.DoubleSide
  };

  const selectPart = (event: any) => {
    event.stopPropagation();
    onSelect({
      name: part.name,
      type: typeLabels[part.type],
      material: part.material,
      dimensions: dimensionsForPart(part),
      note: part.note
    });
  };

  if (part.geometry.kind === "box") {
    const [x, y, z] = part.geometry.origin;
    const [dx, dy, dz] = part.geometry.size;
    const position = toScenePoint([x + dx / 2, y + dy / 2, z + dz / 2]);
    const args: [number, number, number] = [dx * SCALE, dz * SCALE, dy * SCALE];

    return (
      <mesh position={position} castShadow receiveShadow onPointerDown={selectPart}>
        <boxGeometry args={args} />
        <meshStandardMaterial {...materialProps} />
        {(selected || part.type !== "clearance") && <Edges color={selected ? "#ffffff" : "#17202d"} threshold={25} />}
      </mesh>
    );
  }

  return (
    <mesh geometry={prismGeometry ?? undefined} castShadow receiveShadow onPointerDown={selectPart}>
      <meshStandardMaterial {...materialProps} />
      <Edges color={selected ? "#ffffff" : "#17202d"} threshold={25} />
    </mesh>
  );
}

function RoofLayers({ showOsb, showFinishedRoof }: { showOsb: boolean; showFinishedRoof: boolean }) {
  const osbGeometries = useMemo(() => [createRoofSurface("left", 9.5), createRoofSurface("right", 9.5)], []);
  const finishedGeometries = useMemo(() => [createRoofSurface("left", 12.5), createRoofSurface("right", 12.5)], []);

  return (
    <group>
      {showOsb &&
        osbGeometries.map((geometry, index) => (
          <mesh key={`osb-${index}`} geometry={geometry} receiveShadow>
            <meshStandardMaterial color="#b98754" roughness={0.82} metalness={0} transparent opacity={showFinishedRoof ? 0.42 : 0.88} side={THREE.DoubleSide} />
            <Edges color="#7a5131" threshold={8} />
          </mesh>
        ))}
      {showFinishedRoof &&
        finishedGeometries.map((geometry, index) => (
          <mesh key={`finished-roof-${index}`} geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial color="#113f25" roughness={0.9} metalness={0} side={THREE.DoubleSide} />
            <Edges color="#0a2415" threshold={8} />
          </mesh>
        ))}
    </group>
  );
}

function WallLayers({ visible }: { visible: boolean }) {
  if (!visible) return null;

  const wallMaterial = (
    <meshStandardMaterial color="#7b604f" roughness={0.78} metalness={0} transparent opacity={0.72} side={THREE.DoubleSide} />
  );
  const studMaterial = <meshStandardMaterial color="#5a3a2d" roughness={0.62} metalness={0} />;
  const trimMaterial = <meshStandardMaterial color="#2f7d4f" roughness={0.72} metalness={0} />;

  return (
    <group>
      <mesh position={toScenePoint([200, 600.5, 125])} castShadow receiveShadow>
        <boxGeometry args={[3.72, 2.5, 0.016]} />
        {wallMaterial}
        <Edges color="#3b2b22" threshold={8} />
      </mesh>
      {[70, 160, 240, 330].map((x) => (
        <mesh key={`rear-stud-${x}`} position={toScenePoint([x, 599, 125])} castShadow receiveShadow>
          <boxGeometry args={[0.08, 2.5, 0.08]} />
          {studMaterial}
        </mesh>
      ))}
      <mesh position={toScenePoint([200, 597, 7])} castShadow receiveShadow>
        <boxGeometry args={[3.72, 0.14, 0.1]} />
        {trimMaterial}
      </mesh>
      <mesh position={toScenePoint([200, 597, 246])} castShadow receiveShadow>
        <boxGeometry args={[3.72, 0.08, 0.1]} />
        {trimMaterial}
      </mesh>

      <mesh position={toScenePoint([-0.5, 300, 125])} castShadow receiveShadow>
        <boxGeometry args={[0.016, 2.5, 5.72]} />
        {wallMaterial}
        <Edges color="#3b2b22" threshold={8} />
      </mesh>
      {[110, 220, 380, 500].map((y) => (
        <mesh key={`west-stud-${y}`} position={toScenePoint([1, y, 125])} castShadow receiveShadow>
          <boxGeometry args={[0.08, 2.5, 0.08]} />
          {studMaterial}
        </mesh>
      ))}
      <mesh position={toScenePoint([3, 300, 7])} castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.14, 5.72]} />
        {trimMaterial}
      </mesh>
      <mesh position={toScenePoint([3, 300, 246])} castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.08, 5.72]} />
        {trimMaterial}
      </mesh>
    </group>
  );
}

function DimensionLine({
  start,
  end,
  label,
  color = "#c8dcff",
  tick = [0, 12, 0],
  labelOffset = [0, 0, 0]
}: {
  start: Point3;
  end: Point3;
  label: string;
  color?: string;
  tick?: Point3;
  labelOffset?: Point3;
}) {
  const s = scenePoint(start);
  const e = scenePoint(end);
  const tickVector = new THREE.Vector3(...toSceneVector(tick)).multiplyScalar(0.5);
  const mid = s.clone().add(e).multiplyScalar(0.5).add(new THREE.Vector3(...toSceneVector(labelOffset)));

  return (
    <group>
      <Line points={[s, e]} color={color} lineWidth={1.4} />
      <Line points={[s.clone().sub(tickVector), s.clone().add(tickVector)]} color={color} lineWidth={1.4} />
      <Line points={[e.clone().sub(tickVector), e.clone().add(tickVector)]} color={color} lineWidth={1.4} />
      <Billboard position={mid}>
        <Text fontSize={0.085} color="#f8fbff" outlineColor="#0c1520" outlineWidth={0.01} anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function Dimensions() {
  return (
    <group>
      <DimensionLine start={[0, -38, 8]} end={[400, -38, 8]} label="szerokość 400 cm" tick={[0, 0, 22]} labelOffset={[0, -10, 8]} />
      <DimensionLine start={[-38, 0, 8]} end={[-38, 600, 8]} label="długość 600 cm" tick={[22, 0, 0]} labelOffset={[-12, 0, 8]} />
      <DimensionLine start={[-50, 636, 8]} end={[450, 636, 8]} label="dach z okapem 500 cm" tick={[0, 0, 22]} labelOffset={[0, 8, 8]} color="#ffd699" />
      <DimensionLine start={[-30, 0, 0]} end={[-30, 0, 250]} label="słupy 250 cm" tick={[24, 0, 0]} labelOffset={[-14, 0, 0]} color="#a7f0c1" />
      <DimensionLine start={[430, 300, 0]} end={[430, 300, modelMetrics.ridgeZ]} label="kalenica 336,8 cm" tick={[24, 0, 0]} labelOffset={[16, 0, 0]} color="#d8c7ff" />
      <DimensionLine start={[200, 0, 350]} end={[200, modelMetrics.rafterModuleY, 350]} label="moduł krokwi 84,7 cm" tick={[20, 0, 0]} labelOffset={[0, 0, 10]} color="#ffbe84" />
      <DimensionLine start={[171, 529.5, 382]} end={[229, 529.5, 382]} label="komin 58 cm" tick={[0, 0, 16]} labelOffset={[0, 0, 8]} color="#ff9f9c" />
    </group>
  );
}

function SceneArrow({
  origin,
  direction,
  length,
  color,
  label
}: {
  origin: Point3;
  direction: [number, number, number];
  length: number;
  color: string;
  label: string;
}) {
  const arrow = useMemo(() => {
    const helper = new THREE.ArrowHelper(new THREE.Vector3(...direction).normalize(), scenePoint(origin), length, color, length * 0.24, length * 0.1);
    return helper;
  }, [color, direction, length, origin]);

  const labelPosition = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    return scenePoint(origin).add(dir.multiplyScalar(length + 0.08));
  }, [direction, length, origin]);

  return (
    <group>
      <primitive object={arrow} />
      <Billboard position={labelPosition}>
        <Text fontSize={0.075} color="#ffffff" outlineColor="#07111e" outlineWidth={0.01} anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function DownwardLoad({ mode }: { mode: "dead" | "snow" }) {
  const color = mode === "snow" ? "#72d7ff" : "#f4b24d";
  const label = mode === "snow" ? "śnieg dociska dach" : "ciężar pokrycia";
  const length = mode === "snow" ? 0.82 : 0.56;

  return (
    <group>
      {[90, 200, 310].flatMap((x) =>
        [110, 300, 490].map((y) => (
          <SceneArrow key={`${mode}-${x}-${y}`} origin={[x, y, 390]} direction={[0, -1, 0]} length={length} color={color} label={label} />
        ))
      )}
    </group>
  );
}

function WindLoad() {
  return (
    <group>
      {[
        [475, -70, 150],
        [475, -70, 240],
        [475, -70, 320]
      ].map((origin, index) => (
        <SceneArrow key={`wind-${index}`} origin={origin as Point3} direction={[-1, 0, 1]} length={1.08} color="#a889ff" label="wiatr napiera" />
      ))}
      {[
        [80, 150, 292],
        [320, 150, 292],
        [80, 450, 292],
        [320, 450, 292]
      ].map((origin, index) => (
        <SceneArrow key={`uplift-${index}`} origin={origin as Point3} direction={[0, 1, 0]} length={0.58} color="#ff81c0" label="podrywa dach" />
      ))}
    </group>
  );
}

function LoadArrows({ mode }: { mode: LoadMode }) {
  if (mode === "none") return null;
  if (mode === "dead") return <DownwardLoad mode="dead" />;
  if (mode === "snow") return <DownwardLoad mode="snow" />;
  if (mode === "wind") return <WindLoad />;

  return (
    <group>
      <DownwardLoad mode="dead" />
      <DownwardLoad mode="snow" />
      <WindLoad />
    </group>
  );
}

function Hotspot({ point, title, note, onSelect }: { point: Point3; title: string; note: string; onSelect: (selection: Selection) => void }) {
  const position = toScenePoint(point);
  return (
    <group position={position}>
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect({ name: title, type: "detal", note });
        }}
      >
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshStandardMaterial color="#f7f0a0" emissive="#665300" emissiveIntensity={0.45} />
      </mesh>
      <Billboard position={[0, 0.13, 0]}>
        <Text fontSize={0.07} color="#fff8b8" outlineColor="#0a111c" outlineWidth={0.01} anchorX="center" anchorY="middle">
          {title}
        </Text>
      </Billboard>
    </group>
  );
}

const hotspotData: Record<Exclude<ViewPreset, "iso" | "top" | "front" | "side">, { point: Point3; title: string; note: string }> = {
  braceA: {
    point: [42, 6, 226],
    title: "Zastrzały A",
    note: "Zastrzały A usztywniają słupy z wieńcem w pionie. Są kluczowe przy bocznym bujaniu konstrukcji."
  },
  braceB: {
    point: [58, 58, 262],
    title: "Zastrzały B",
    note: "Zastrzały B pracują w płaszczyźnie wieńca i spinają narożniki od góry."
  },
  ridge: {
    point: [200, 300, modelMetrics.ridgeZ],
    title: "Kalenica i BK",
    note: "Krokwie mają pionowe cięcie przy styku, a BK 7x7 cm pracuje pod nimi jako belka podkalenicowa."
  },
  ties: {
    point: [200, 255, 302],
    title: "Jętki",
    note: "Jętki 7x7 cm spinają pary krokwi i ograniczają rozpychanie połaci na boki."
  },
  supports: {
    point: [114, 3, 282],
    title: "Podpory P",
    note: "Podpory P stoją na wieńcu i podpierają jętkę w strefie frontu oraz tyłu."
  }
};

const viewSelection: Record<ViewPreset, Selection> = {
  iso: {
    name: "Altanka",
    type: "widok ogólny",
    note: "Pełny układ 400x600 cm z dachem 20°, okapem 50 cm, grillem i niezależnym kominem."
  },
  top: {
    name: "Rzut z góry",
    type: "rzut",
    note: "Najlepszy do kontroli osi komina, rozstawu krokwi, pozycji słupów i obrysu dachu z okapem."
  },
  front: {
    name: "Widok frontowy",
    type: "rzut",
    note: "Pokazuje geometrię dwuspadowego dachu, wysokość słupów, jętki oraz BK pod kalenicą."
  },
  side: {
    name: "Widok boczny",
    type: "rzut",
    note: "Pomaga sprawdzić długość 600 cm, słupy środkowe, zastrzały boczne i pozycję grilla przy tyle."
  },
  braceA: { name: hotspotData.braceA.title, type: "detal", note: hotspotData.braceA.note },
  braceB: { name: hotspotData.braceB.title, type: "detal", note: hotspotData.braceB.note },
  ridge: { name: hotspotData.ridge.title, type: "detal", note: hotspotData.ridge.note },
  ties: { name: hotspotData.ties.title, type: "detal", note: hotspotData.ties.note },
  supports: { name: hotspotData.supports.title, type: "detal", note: hotspotData.supports.note }
};

const Scene = forwardRef<
  CameraApi,
  {
    parts: PartSpec[];
    showDimensions: boolean;
    showOsb: boolean;
    showFinishedRoof: boolean;
    showWalls: boolean;
    loadMode: LoadMode;
    selectedName?: string;
    onSelect: (selection: Selection) => void;
  }
>(({ parts, showDimensions, showOsb, showFinishedRoof, showWalls, loadMode, selectedName, onSelect }, ref) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useImperativeHandle(
    ref,
    () => ({
      setPreset(preset: ViewPreset) {
        const target = new THREE.Vector3(0, 1.65, 0);
        const position = new THREE.Vector3(7.2, 5.2, 8.2);
        const up = new THREE.Vector3(0, 1, 0);

        if (preset === "top") {
          position.set(0, 16.2, 0.02);
          target.set(0, 0, 0);
          up.set(0, 0, -1);
        } else if (preset === "front") {
          position.set(0, 2.2, -13.6);
          target.set(0, 1.7, 0);
        } else if (preset === "side") {
          position.set(14.4, 2.25, 0);
          target.set(0, 1.7, 0);
        } else if (preset === "braceA") {
          position.set(-2.6, 2.75, -3.85);
          target.set(-1.62, 2.28, -2.92);
        } else if (preset === "braceB") {
          position.set(-2.2, 3.28, -3.1);
          target.set(-1.46, 2.6, -2.42);
        } else if (preset === "ridge") {
          position.set(2.75, 3.9, 2.85);
          target.set(0, 3.3, 0);
        } else if (preset === "ties") {
          position.set(2.8, 3.4, -1.65);
          target.set(0, 3.0, -0.45);
        } else if (preset === "supports") {
          position.set(-2.7, 3.15, -4.15);
          target.set(-0.88, 2.82, -2.97);
        }

        camera.up.copy(up);
        camera.position.copy(position);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
        if (controlsRef.current) {
          controlsRef.current.target.copy(target);
          controlsRef.current.update();
        }
      },
    }),
    [camera]
  );

  return (
    <>
      <color attach="background" args={["#08111d"]} />
      <fog attach="fog" args={["#08111d", 24, 70]} />
      <ambientLight intensity={0.58} />
      <directionalLight castShadow position={[3.8, 6.5, 4.5]} intensity={2.4} shadow-mapSize={[2048, 2048]} />
      <Environment preset="city" />
      <Grid position={[0, -0.004, 0]} args={[12, 12]} cellSize={0.5} cellThickness={0.55} cellColor="#29405f" sectionSize={1} sectionThickness={1.1} sectionColor="#526d91" fadeDistance={28} fadeStrength={0.72} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={8.6} blur={2.2} far={4} />

      <group onPointerMissed={() => onSelect(viewSelection.iso)}>
        {parts.map((part) => (
          <PartMesh key={part.id} part={part} selected={part.name === selectedName} onSelect={onSelect} />
        ))}
        <RoofLayers showOsb={showOsb} showFinishedRoof={showFinishedRoof} />
        <WallLayers visible={showWalls} />
        {showDimensions && <Dimensions />}
        <LoadArrows mode={loadMode} />
        {Object.values(hotspotData).map((hotspot) => (
          <Hotspot key={hotspot.title} {...hotspot} onSelect={onSelect} />
        ))}
      </group>

      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minDistance={1.1} maxDistance={40} />
    </>
  );
});

function InfoPanel({ selection, isOpen, onClose }: { selection: Selection; isOpen: boolean; onClose: () => void }) {
  return (
    <aside className={`info-panel ${isOpen ? "is-open" : "is-hidden"}`}>
      <button className="panel-close" type="button" onClick={onClose} aria-label="Schowaj opis">
        <X size={17} />
      </button>
      <div className="info-content">
        <span>{selection.type}</span>
        <h2>{selection.name}</h2>
        {selection.material && <strong>{selection.material}</strong>}
        {selection.dimensions && <strong>{selection.dimensions}</strong>}
        {selection.note && <p>{selection.note}</p>}
      </div>
    </aside>
  );
}

function App() {
  const allParts = useMemo(() => buildModel(), []);
  const cameraApi = useRef<CameraApi | null>(null);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showGrill, setShowGrill] = useState(true);
  const [showClearance, setShowClearance] = useState(true);
  const [showOsb, setShowOsb] = useState(false);
  const [showFinishedRoof, setShowFinishedRoof] = useState(false);
  const [showWalls, setShowWalls] = useState(false);
  const [loadMode, setLoadMode] = useState<LoadMode>("none");
  const [selected, setSelected] = useState<Selection>(viewSelection.iso);
  const [activeView, setActiveView] = useState<ViewPreset>("iso");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setInfoOpen(false);
    }
  }, []);

  const visibleParts = useMemo(
    () =>
      allParts.filter((part) => {
        if (!showGrill && (part.type === "masonry" || part.type === "chimney")) return false;
        if ((!showClearance || !showGrill) && part.type === "clearance") return false;
        return true;
      }),
    [allParts, showClearance, showGrill]
  );

  const setView = (preset: ViewPreset) => {
    setActiveView(preset);
    setSelected(viewSelection[preset]);
    setInfoOpen(true);
    cameraApi.current?.setPreset(preset);
  };

  const setLoad = (mode: LoadMode) => {
    setLoadMode(mode);
    if (mode !== "none") {
      const load = loadCopy[mode];
      setSelected({
        name: load.title,
        type: "obciążenie",
        note: [load.value, load.note, load.technical].filter(Boolean).join(" ")
      });
      setInfoOpen(true);
    }
  };

  return (
    <main className="app-shell">
      <section className="viewport">
        <Canvas shadows camera={{ position: [7.2, 5.2, 8.2], fov: 38, near: 0.05, far: 200 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <Scene
            ref={cameraApi}
            parts={visibleParts}
            showDimensions={showDimensions}
            showOsb={showOsb}
            showFinishedRoof={showFinishedRoof}
            showWalls={showWalls}
            loadMode={loadMode}
            selectedName={selected.name}
            onSelect={(selection) => {
              setSelected(selection);
              setInfoOpen(true);
            }}
          />
        </Canvas>
      </section>

      <header className="topbar">
        <div className="top-actions">
          <button className="utility-button" type="button" onClick={() => setControlsOpen((value) => !value)}>
            <Menu size={16} />
            <span>Panel</span>
          </button>
          <button className="utility-button" type="button" onClick={() => setInfoOpen((value) => !value)}>
            <Info size={16} />
            <span>Opis</span>
          </button>
        </div>
        <div className="view-strip" aria-label="Widoki">
          {(["iso", "top", "front", "side", "braceA", "braceB", "ridge", "ties", "supports"] as ViewPreset[]).map((preset) => (
            <button key={preset} className={activeView === preset ? "is-active" : ""} type="button" onClick={() => setView(preset)} title={viewLabels[preset]}>
              <span>{viewShortLabels[preset]}</span>
            </button>
          ))}
        </div>
      </header>

      <aside className={`control-panel ${controlsOpen ? "is-open" : "is-hidden"}`}>
        <button className="panel-close" type="button" onClick={() => setControlsOpen(false)} aria-label="Schowaj panel">
          <X size={17} />
        </button>
        <div className="panel-section">
          <div className="section-title">Warstwy</div>
          <ToggleButton active={showDimensions} icon={<Ruler size={17} />} label="Wymiary" onClick={() => setShowDimensions((value) => !value)} />
          <ToggleButton active={showGrill} icon={<Flame size={17} />} label="Grill i komin" onClick={() => setShowGrill((value) => !value)} />
          <ToggleButton active={showClearance} icon={<ShieldAlert size={17} />} label="Strefa komina" onClick={() => setShowClearance((value) => !value)} />
          <ToggleButton active={showOsb} icon={<Layers size={17} />} label="Płyta OSB" onClick={() => setShowOsb((value) => !value)} />
          <ToggleButton active={showFinishedRoof} icon={<Layers size={17} />} label="Papa + zielony gont" onClick={() => setShowFinishedRoof((value) => !value)} />
          <ToggleButton active={showWalls} icon={<Layers size={17} />} label="Ściany drewniane" onClick={() => setShowWalls((value) => !value)} />
        </div>

        <div className="panel-section">
          <div className="section-title">Obciążenia</div>
          <div className="segmented">
            <button className={loadMode === "none" ? "is-active" : ""} type="button" onClick={() => setLoad("none")}>Model</button>
            <button className={loadMode === "dead" ? "is-active" : ""} type="button" onClick={() => setLoad("dead")}><Weight size={15} />Pokrycie</button>
            <button className={loadMode === "snow" ? "is-active" : ""} type="button" onClick={() => setLoad("snow")}><Snowflake size={15} />Śnieg</button>
            <button className={loadMode === "wind" ? "is-active" : ""} type="button" onClick={() => setLoad("wind")}><Wind size={15} />Wiatr</button>
            <button className={`wide ${loadMode === "all" ? "is-active" : ""}`} type="button" onClick={() => setLoad("all")}>Wszystko razem</button>
          </div>
        </div>

        <div className="panel-section document-section">
          <a className="download-document" href={`${import.meta.env.BASE_URL}Altanka_dokumentacja.pdf`} download>
            <FileText size={17} />
            <span>Pobierz dokumentację PDF</span>
            <Download size={16} />
          </a>
        </div>
      </aside>

      <InfoPanel selection={selected} isOpen={infoOpen} onClose={() => setInfoOpen(false)} />
    </main>
  );
}

export default App;
