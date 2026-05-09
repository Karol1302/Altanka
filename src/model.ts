import spec from "../structure_spec_v13.json";

export type PartType =
  | "post"
  | "beam"
  | "rafter"
  | "ridge"
  | "tie"
  | "support"
  | "braceA"
  | "braceB"
  | "metal"
  | "masonry"
  | "chimney"
  | "clearance";

export type Point3 = [number, number, number];
export type Point2 = [number, number];

export type BoxGeometrySpec = {
  kind: "box";
  origin: Point3;
  size: Point3;
};

export type PrismGeometrySpec = {
  kind: "prism";
  base: Point3[];
  extrusion: Point3;
};

export type PartSpec = {
  id: string;
  name: string;
  type: PartType;
  material: string;
  geometry: BoxGeometrySpec | PrismGeometrySpec;
  labelable?: boolean;
  transparent?: boolean;
  opacity?: number;
  note?: string;
};

type StructureSpec = typeof spec;

export const structureSpec = spec as StructureSpec;

export const SCALE = 0.01;

export const colors: Record<PartType, string> = {
  post: "#8a674f",
  beam: "#5a3a2d",
  rafter: "#e67823",
  ridge: "#7150a8",
  tie: "#2f7d4f",
  support: "#2f7d4f",
  braceA: "#c84848",
  braceB: "#2e69a8",
  metal: "#b9c1ca",
  masonry: "#935b3c",
  chimney: "#8e969f",
  clearance: "#ff493d"
};

const g = structureSpec.global;
const e = structureSpec.elements;

const WIDTH = g.width;
const LENGTH = g.length;
const POST_SECTION = e.posts.section[0];
const POST_HEIGHT = e.posts.height;
const BEAM_SECTION = e.beams_ring.section[0];
const ROOF_ANGLE = (g.roof_angle_deg * Math.PI) / 180;
const OVERHANG = g.overhang_each_side_x;
const RAFTER_WIDTH_Y = e.rafters.section[0];
const RAFTER_DEPTH = e.rafters.section[1];
const RIDGE_Z = g.ridge_z;
const EAVE_Z = g.eave_z;
const TOP_BEAM_Z = g.top_beam_z;

const BRACE_A_LONG = e.brace_A.long_base;
const BRACE_A_SHORT = e.brace_A.short_base;
const BRACE_A_THICKNESS = e.brace_A.thickness;
const BRACE_B_LONG = e.brace_B.long_base;
const BRACE_B_SHORT = e.brace_B.short_base;
const BRACE_B_THICKNESS = e.brace_B.thickness;

const ANGLE_BRACKET_SIZE = 10;
const ANGLE_BRACKET_THICKNESS = 0.4;
const MIDDLE_BRACKET_SHIFT = 7;

const POST_BASE_HEIGHT_ABOVE_CONCRETE = 5;
const POST_BASE_PLATE_THICKNESS = 0.6;
const POST_BASE_PLATE_SIZE = 18;
const POST_BASE_SIDE_PLATE_HEIGHT = 12;
const POST_BASE_SIDE_PLATE_THICKNESS = 0.5;

const TIE_END_SHORTEN = e.ties_J.shorten_each_end;

const makeId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function box(
  parts: PartSpec[],
  name: string,
  type: PartType,
  origin: Point3,
  size: Point3,
  material: string,
  options: Partial<PartSpec> = {}
) {
  parts.push({
    id: makeId(name),
    name,
    type,
    material,
    geometry: { kind: "box", origin, size },
    ...options
  });
}

function prism(
  parts: PartSpec[],
  name: string,
  type: PartType,
  base: Point3[],
  extrusion: Point3,
  material: string,
  options: Partial<PartSpec> = {}
) {
  parts.push({
    id: makeId(name),
    name,
    type,
    material,
    geometry: { kind: "prism", base, extrusion },
    ...options
  });
}

function prismXZ(
  parts: PartSpec[],
  name: string,
  type: PartType,
  pointsXZ: Point2[],
  y: number,
  thicknessY: number,
  material: string
) {
  prism(
    parts,
    name,
    type,
    pointsXZ.map(([x, z]) => [x, y, z]),
    [0, thicknessY, 0],
    material
  );
}

function prismYZ(
  parts: PartSpec[],
  name: string,
  type: PartType,
  pointsYZ: Point2[],
  x: number,
  thicknessX: number,
  material: string
) {
  prism(
    parts,
    name,
    type,
    pointsYZ.map(([y, z]) => [x, y, z]),
    [thicknessX, 0, 0],
    material
  );
}

function prismXY(
  parts: PartSpec[],
  name: string,
  type: PartType,
  pointsXY: Point2[],
  z: number,
  thicknessZ: number,
  material: string
) {
  prism(
    parts,
    name,
    type,
    pointsXY.map(([x, y]) => [x, y, z]),
    [0, 0, thicknessZ],
    material
  );
}

function thickSegment2d(p1: Point2, p2: Point2, width: number): Point2[] {
  const [x1, z1] = p1;
  const [x2, z2] = p2;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const nx = (-dz / length) * (width / 2);
  const nz = (dx / length) * (width / 2);

  return [
    [x1 + nx, z1 + nz],
    [x2 + nx, z2 + nz],
    [x2 - nx, z2 - nz],
    [x1 - nx, z1 - nz]
  ];
}

function clipPolygonVertical(points: Point2[], xClip: number, keepLeft: boolean): Point2[] {
  const inside = ([x]: Point2) => (keepLeft ? x <= xClip + 1e-9 : x >= xClip - 1e-9);
  const intersect = (p1: Point2, p2: Point2): Point2 => {
    const [x1, z1] = p1;
    const [x2, z2] = p2;
    if (Math.abs(x2 - x1) < 1e-9) {
      return [xClip, z1];
    }
    const t = (xClip - x1) / (x2 - x1);
    return [xClip, z1 + t * (z2 - z1)];
  };

  const output: Point2[] = [];
  let previous = points[points.length - 1];
  let previousInside = inside(previous);

  for (const current of points) {
    const currentInside = inside(current);
    if (currentInside) {
      if (!previousInside) output.push(intersect(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
    previous = current;
    previousInside = currentInside;
  }

  return output;
}

function rafterProfileLeft(): Point2[] {
  const points = thickSegment2d(
    [-OVERHANG, EAVE_Z],
    [WIDTH / 2 + 20, RIDGE_Z + 20 * Math.tan(ROOF_ANGLE)],
    RAFTER_DEPTH
  );
  return clipPolygonVertical(points, WIDTH / 2, true);
}

function rafterProfileRight(): Point2[] {
  const points = thickSegment2d(
    [WIDTH / 2 - 20, RIDGE_Z + 20 * Math.tan(ROOF_ANGLE)],
    [WIDTH + OVERHANG, EAVE_Z],
    RAFTER_DEPTH
  );
  return clipPolygonVertical(points, WIDTH / 2, false);
}

function tieProfile(): Point2[] {
  const baseLength = e.ties_J.base_length;
  const tieSection = e.ties_J.section[0];
  const x0 = WIDTH / 2 - baseLength / 2 + TIE_END_SHORTEN;
  const x1 = WIDTH / 2 + baseLength / 2 - TIE_END_SHORTEN;
  const z0 = e.ties_J.z_bottom;
  const z1 = e.ties_J.z_top;
  const cutDx = tieSection / Math.tan(ROOF_ANGLE);

  return [
    [x0, z0],
    [x1, z0],
    [x1 - cutDx, z1],
    [x0 + cutDx, z1]
  ];
}

function brace45FromInnerCorner(
  cornerX: number,
  cornerZ: number,
  sx: number,
  sz: number,
  shortDiag: number,
  longDiag: number
): Point2[] {
  const contactLength = (longDiag - shortDiag) / Math.SQRT2;
  const offset = shortDiag / Math.SQRT2;

  return [
    [cornerX, cornerZ + sz * (offset + contactLength)],
    [cornerX, cornerZ + sz * offset],
    [cornerX + sx * offset, cornerZ],
    [cornerX + sx * (offset + contactLength), cornerZ]
  ];
}

function brace45TopFromInnerCorner(
  cornerX: number,
  cornerY: number,
  sx: number,
  sy: number,
  shortDiag: number,
  longDiag: number
): Point2[] {
  const contactLength = (longDiag - shortDiag) / Math.SQRT2;
  const offset = shortDiag / Math.SQRT2;

  return [
    [cornerX, cornerY + sy * (offset + contactLength)],
    [cornerX, cornerY + sy * offset],
    [cornerX + sx * offset, cornerY],
    [cornerX + sx * (offset + contactLength), cornerY]
  ];
}

function shiftYZ(points: Point2[], shiftY: number): Point2[] {
  return points.map(([y, z]) => [y + shiftY, z]);
}

function addPostBase(parts: PartSpec[], name: string, x: number, y: number, orientation: "side_x" | "side_y") {
  box(
    parts,
    `${name}_BASE_PLATE`,
    "metal",
    [
      x - (POST_BASE_PLATE_SIZE - POST_SECTION) / 2,
      y - (POST_BASE_PLATE_SIZE - POST_SECTION) / 2,
      POST_BASE_HEIGHT_ABOVE_CONCRETE - POST_BASE_PLATE_THICKNESS
    ],
    [POST_BASE_PLATE_SIZE, POST_BASE_PLATE_SIZE, POST_BASE_PLATE_THICKNESS],
    "stal ocynkowana",
    { labelable: false }
  );

  if (orientation === "side_x") {
    box(parts, `${name}_SIDE_PLATE_X_MINUS`, "metal", [x - POST_BASE_SIDE_PLATE_THICKNESS, y, 0], [POST_BASE_SIDE_PLATE_THICKNESS, POST_SECTION, POST_BASE_SIDE_PLATE_HEIGHT], "stal ocynkowana", { labelable: false });
    box(parts, `${name}_SIDE_PLATE_X_PLUS`, "metal", [x + POST_SECTION, y, 0], [POST_BASE_SIDE_PLATE_THICKNESS, POST_SECTION, POST_BASE_SIDE_PLATE_HEIGHT], "stal ocynkowana", { labelable: false });
  } else {
    box(parts, `${name}_SIDE_PLATE_Y_MINUS`, "metal", [x, y - POST_BASE_SIDE_PLATE_THICKNESS, 0], [POST_SECTION, POST_BASE_SIDE_PLATE_THICKNESS, POST_BASE_SIDE_PLATE_HEIGHT], "stal ocynkowana", { labelable: false });
    box(parts, `${name}_SIDE_PLATE_Y_PLUS`, "metal", [x, y + POST_SECTION, 0], [POST_SECTION, POST_BASE_SIDE_PLATE_THICKNESS, POST_BASE_SIDE_PLATE_HEIGHT], "stal ocynkowana", { labelable: false });
  }
}

function addCornerAngleXZ(parts: PartSpec[], name: string, xCorner: number, y: number, zCorner: number, sx: number) {
  const xVert = sx > 0 ? xCorner - ANGLE_BRACKET_THICKNESS : xCorner;
  box(parts, `${name}_VERT_ON_POST`, "metal", [xVert, y, zCorner - ANGLE_BRACKET_SIZE], [ANGLE_BRACKET_THICKNESS, ANGLE_BRACKET_SIZE, ANGLE_BRACKET_SIZE], "stal ocynkowana", { labelable: false });

  const xHor = sx > 0 ? xCorner : xCorner - ANGLE_BRACKET_SIZE;
  box(parts, `${name}_HOR_ON_BEAM`, "metal", [xHor, y, zCorner - ANGLE_BRACKET_THICKNESS], [ANGLE_BRACKET_SIZE, ANGLE_BRACKET_SIZE, ANGLE_BRACKET_THICKNESS], "stal ocynkowana", { labelable: false });
}

function addCornerAngleYZ(parts: PartSpec[], name: string, x: number, yCorner: number, zCorner: number, sy: number) {
  const yVert = sy > 0 ? yCorner - ANGLE_BRACKET_THICKNESS : yCorner;
  box(parts, `${name}_VERT_ON_POST`, "metal", [x, yVert, zCorner - ANGLE_BRACKET_SIZE], [ANGLE_BRACKET_SIZE, ANGLE_BRACKET_THICKNESS, ANGLE_BRACKET_SIZE], "stal ocynkowana", { labelable: false });

  const yHor = sy > 0 ? yCorner : yCorner - ANGLE_BRACKET_SIZE;
  box(parts, `${name}_HOR_ON_BEAM`, "metal", [x, yHor, zCorner - ANGLE_BRACKET_THICKNESS], [ANGLE_BRACKET_SIZE, ANGLE_BRACKET_SIZE, ANGLE_BRACKET_THICKNESS], "stal ocynkowana", { labelable: false });
}

export function buildModel() {
  const parts: PartSpec[] = [];

  Object.entries(e.posts.positions_xy_lower_left).forEach(([name, [x, y]]) => {
    box(parts, name, "post", [x, y, 0], [POST_SECTION, POST_SECTION, POST_HEIGHT], "sosna C18");
  });

  box(parts, "W_FRONT_400cm", "beam", [0, 0, POST_HEIGHT], [WIDTH, BEAM_SECTION, BEAM_SECTION], "świerk C24");
  box(parts, "W_BACK_400cm", "beam", [0, LENGTH - BEAM_SECTION, POST_HEIGHT], [WIDTH, BEAM_SECTION, BEAM_SECTION], "świerk C24");
  box(parts, "W_LEFT_1_300cm", "beam", [0, 0, POST_HEIGHT], [BEAM_SECTION, LENGTH / 2, BEAM_SECTION], "świerk C24");
  box(parts, "W_LEFT_2_300cm", "beam", [0, LENGTH / 2, POST_HEIGHT], [BEAM_SECTION, LENGTH / 2, BEAM_SECTION], "świerk C24");
  box(parts, "W_RIGHT_1_300cm", "beam", [WIDTH - BEAM_SECTION, 0, POST_HEIGHT], [BEAM_SECTION, LENGTH / 2, BEAM_SECTION], "świerk C24");
  box(parts, "W_RIGHT_2_300cm", "beam", [WIDTH - BEAM_SECTION, LENGTH / 2, POST_HEIGHT], [BEAM_SECTION, LENGTH / 2, BEAM_SECTION], "świerk C24");

  e.rafters.y_positions.forEach((y, index) => {
    prismXZ(parts, `K${index + 1}_LEFT_14x7_VERTICAL_RIDGE_CUT`, "rafter", rafterProfileLeft(), y, RAFTER_WIDTH_Y, "świerk C24");
    prismXZ(parts, `K${index + 1}_RIGHT_14x7_VERTICAL_RIDGE_CUT`, "rafter", rafterProfileRight(), y, RAFTER_WIDTH_Y, "świerk C24");
  });

  box(parts, "BK_7x7_600cm_UNDER_RAFTERS", "ridge", [e.BK.position.x, e.BK.position.y, e.BK.position.z], [e.BK.section[0], e.BK.length, e.BK.section[1]], "świerk C24");

  e.ties_J.y_positions.forEach((y, index) => {
    prismXZ(parts, `J${index + 1}_7x7_200cm_CUT_TO_RAFTER`, "tie", tieProfile(), y, RAFTER_WIDTH_Y, "świerk C24");
  });

  const supportSection = e.supports_P.section[0];
  box(parts, "P_FRONT_LEFT_7x7_SUPPORTS_TIE", "support", [e.supports_P.x_positions.left, e.supports_P.y_positions.front, e.supports_P.z_bottom], [supportSection, RAFTER_WIDTH_Y, e.supports_P.height], "świerk C24");
  box(parts, "P_FRONT_RIGHT_7x7_SUPPORTS_TIE", "support", [e.supports_P.x_positions.right, e.supports_P.y_positions.front, e.supports_P.z_bottom], [supportSection, RAFTER_WIDTH_Y, e.supports_P.height], "świerk C24");
  box(parts, "P_BACK_LEFT_7x7_SUPPORTS_TIE", "support", [e.supports_P.x_positions.left, e.supports_P.y_positions.back, e.supports_P.z_bottom], [supportSection, RAFTER_WIDTH_Y, e.supports_P.height], "świerk C24");
  box(parts, "P_BACK_RIGHT_7x7_SUPPORTS_TIE", "support", [e.supports_P.x_positions.right, e.supports_P.y_positions.back, e.supports_P.z_bottom], [supportSection, RAFTER_WIDTH_Y, e.supports_P.height], "świerk C24");

  const frontLeftA = brace45FromInnerCorner(POST_SECTION, POST_HEIGHT, +1, -1, BRACE_A_SHORT, BRACE_A_LONG);
  const frontRightA = brace45FromInnerCorner(WIDTH - POST_SECTION, POST_HEIGHT, -1, -1, BRACE_A_SHORT, BRACE_A_LONG);
  prismXZ(parts, "A_FRONT_LEFT", "braceA", frontLeftA, 0, BRACE_A_THICKNESS, "sosna C18");
  prismXZ(parts, "A_FRONT_RIGHT", "braceA", frontRightA, 0, BRACE_A_THICKNESS, "sosna C18");
  prismXZ(parts, "A_BACK_LEFT", "braceA", frontLeftA, LENGTH - BRACE_A_THICKNESS, BRACE_A_THICKNESS, "sosna C18");
  prismXZ(parts, "A_BACK_RIGHT", "braceA", frontRightA, LENGTH - BRACE_A_THICKNESS, BRACE_A_THICKNESS, "sosna C18");

  const sideAPoints = (yCorner: number, directionY: number) =>
    brace45FromInnerCorner(yCorner, POST_HEIGHT, directionY, -1, BRACE_A_SHORT, BRACE_A_LONG);

  prismYZ(parts, "A_LEFT_FRONT", "braceA", sideAPoints(POST_SECTION, +1), 0, BRACE_A_THICKNESS, "sosna C18");
  prismYZ(parts, "A_LEFT_MID_TO_FRONT_SHIFTED_MINUS_7CM", "braceA", shiftYZ(sideAPoints(LENGTH / 2, -1), -7), 0, BRACE_A_THICKNESS, "sosna C18");
  prismYZ(parts, "A_LEFT_MID_TO_BACK_SHIFTED_PLUS_7CM", "braceA", shiftYZ(sideAPoints(LENGTH / 2, +1), +7), 0, BRACE_A_THICKNESS, "sosna C18");
  prismYZ(parts, "A_LEFT_BACK", "braceA", sideAPoints(LENGTH - POST_SECTION, -1), 0, BRACE_A_THICKNESS, "sosna C18");
  prismYZ(parts, "A_RIGHT_FRONT", "braceA", sideAPoints(POST_SECTION, +1), WIDTH, -BRACE_A_THICKNESS, "sosna C18");
  prismYZ(parts, "A_RIGHT_MID_TO_FRONT_SHIFTED_MINUS_7CM", "braceA", shiftYZ(sideAPoints(LENGTH / 2, -1), -7), WIDTH, -BRACE_A_THICKNESS, "sosna C18");
  prismYZ(parts, "A_RIGHT_MID_TO_BACK_SHIFTED_PLUS_7CM", "braceA", shiftYZ(sideAPoints(LENGTH / 2, +1), +7), WIDTH, -BRACE_A_THICKNESS, "sosna C18");
  prismYZ(parts, "A_RIGHT_BACK", "braceA", sideAPoints(LENGTH - POST_SECTION, -1), WIDTH, -BRACE_A_THICKNESS, "sosna C18");

  const braceBZ = e.brace_B.z_bottom;
  prismXY(parts, "B_FRONT_LEFT", "braceB", brace45TopFromInnerCorner(BEAM_SECTION, BEAM_SECTION, +1, +1, BRACE_B_SHORT, BRACE_B_LONG), braceBZ, BRACE_B_THICKNESS, "sosna C18");
  prismXY(parts, "B_FRONT_RIGHT", "braceB", brace45TopFromInnerCorner(WIDTH - BEAM_SECTION, BEAM_SECTION, -1, +1, BRACE_B_SHORT, BRACE_B_LONG), braceBZ, BRACE_B_THICKNESS, "sosna C18");
  prismXY(parts, "B_BACK_LEFT", "braceB", brace45TopFromInnerCorner(BEAM_SECTION, LENGTH - BEAM_SECTION, +1, -1, BRACE_B_SHORT, BRACE_B_LONG), braceBZ, BRACE_B_THICKNESS, "sosna C18");
  prismXY(parts, "B_BACK_RIGHT", "braceB", brace45TopFromInnerCorner(WIDTH - BEAM_SECTION, LENGTH - BEAM_SECTION, -1, -1, BRACE_B_SHORT, BRACE_B_LONG), braceBZ, BRACE_B_THICKNESS, "sosna C18");

  addPostBase(parts, "PB_S1", 0, 0, "side_x");
  addPostBase(parts, "PB_S2", WIDTH - POST_SECTION, 0, "side_x");
  addPostBase(parts, "PB_S3", 0, LENGTH / 2 - POST_SECTION / 2, "side_y");
  addPostBase(parts, "PB_S4", WIDTH - POST_SECTION, LENGTH / 2 - POST_SECTION / 2, "side_y");
  addPostBase(parts, "PB_S5", 0, LENGTH - POST_SECTION, "side_x");
  addPostBase(parts, "PB_S6", WIDTH - POST_SECTION, LENGTH - POST_SECTION, "side_x");

  addCornerAngleXZ(parts, "AB_FRONT_LEFT", POST_SECTION, 0, POST_HEIGHT, +1);
  addCornerAngleXZ(parts, "AB_FRONT_RIGHT", WIDTH - POST_SECTION, 0, POST_HEIGHT, -1);
  addCornerAngleXZ(parts, "AB_BACK_LEFT", POST_SECTION, LENGTH - ANGLE_BRACKET_SIZE, POST_HEIGHT, +1);
  addCornerAngleXZ(parts, "AB_BACK_RIGHT", WIDTH - POST_SECTION, LENGTH - ANGLE_BRACKET_SIZE, POST_HEIGHT, -1);
  addCornerAngleYZ(parts, "AB_LEFT_FRONT", 0, POST_SECTION, POST_HEIGHT, +1);
  addCornerAngleYZ(parts, "AB_LEFT_MID_TO_FRONT", 0, LENGTH / 2 - MIDDLE_BRACKET_SHIFT, POST_HEIGHT, -1);
  addCornerAngleYZ(parts, "AB_LEFT_MID_TO_BACK", 0, LENGTH / 2 + MIDDLE_BRACKET_SHIFT, POST_HEIGHT, +1);
  addCornerAngleYZ(parts, "AB_LEFT_BACK", 0, LENGTH - POST_SECTION, POST_HEIGHT, -1);
  addCornerAngleYZ(parts, "AB_RIGHT_FRONT", WIDTH - ANGLE_BRACKET_SIZE, POST_SECTION, POST_HEIGHT, +1);
  addCornerAngleYZ(parts, "AB_RIGHT_MID_TO_FRONT", WIDTH - ANGLE_BRACKET_SIZE, LENGTH / 2 - MIDDLE_BRACKET_SHIFT, POST_HEIGHT, -1);
  addCornerAngleYZ(parts, "AB_RIGHT_MID_TO_BACK", WIDTH - ANGLE_BRACKET_SIZE, LENGTH / 2 + MIDDLE_BRACKET_SHIFT, POST_HEIGHT, +1);
  addCornerAngleYZ(parts, "AB_RIGHT_BACK", WIDTH - ANGLE_BRACKET_SIZE, LENGTH - POST_SECTION, POST_HEIGHT, -1);

  box(parts, "GRILL_MASONRY_BASE_120x80", "masonry", e.grill.position_lower_left as Point3, e.grill.dimensions as Point3, "mur/cegła");
  box(parts, "CHIMNEY_58x45_INDEPENDENT_BETWEEN_RAFTERS", "chimney", e.chimney.position_lower_left as Point3, e.chimney.dimensions as Point3, "komin murowany", {
    note: "Komin jest niezależny od drewna i nie podpiera dachu."
  });
  box(parts, "CHIMNEY_CLEARANCE_ZONE_NO_WOOD", "clearance", e.chimney.clearance_zone.position_lower_left as Point3, e.chimney.clearance_zone.dimensions as Point3, "strefa bez drewna", {
    transparent: true,
    opacity: 0.18,
    note: "Strefa bez drewna 8 cm wokół komina."
  });

  return parts;
}

export function partPoints(part: PartSpec): Point3[] {
  if (part.geometry.kind === "box") {
    const [x, y, z] = part.geometry.origin;
    const [dx, dy, dz] = part.geometry.size;
    return [
      [x, y, z],
      [x + dx, y + dy, z + dz]
    ];
  }

  const { base, extrusion } = part.geometry;
  return base.flatMap((point) => [
    point,
    [point[0] + extrusion[0], point[1] + extrusion[1], point[2] + extrusion[2]] as Point3
  ]);
}

export function partCenter(part: PartSpec): Point3 {
  const points = partPoints(part);
  const min: Point3 = [Infinity, Infinity, Infinity];
  const max: Point3 = [-Infinity, -Infinity, -Infinity];
  points.forEach((point) => {
    point.forEach((value, index) => {
      min[index] = Math.min(min[index], value);
      max[index] = Math.max(max[index], value);
    });
  });

  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

export function toScenePoint([x, y, z]: Point3): [number, number, number] {
  return [(x - WIDTH / 2) * SCALE, z * SCALE, (y - LENGTH / 2) * SCALE];
}

export function toSceneVector([x, y, z]: Point3): [number, number, number] {
  return [x * SCALE, z * SCALE, y * SCALE];
}

export const modelMetrics = {
  width: WIDTH,
  length: LENGTH,
  roofWidth: g.roof_width_with_overhang,
  roofLength: g.roof_length,
  overhangEachSideX: g.overhang_each_side_x,
  ridgeZ: g.ridge_z,
  eaveZ: g.eave_z,
  topBeamZ: g.top_beam_z,
  roofAngleDeg: g.roof_angle_deg,
  rafterModuleY: e.rafters.module_y,
  rafterClearY: e.rafters.clear_spacing_y,
  rafterAxisLength: e.rafters.axis_length,
  chimneyTopZ: e.chimney.top_z,
  chimneyClearance: e.chimney.clearance_zone.clearance_each_side,
  loads: structureSpec.loads_reference
};

export const typeLabels: Record<PartType, string> = {
  post: "słup",
  beam: "wieniec",
  rafter: "krokiew",
  ridge: "BK",
  tie: "jętka",
  support: "podpora P",
  braceA: "zastrzał A",
  braceB: "zastrzał B",
  metal: "łącznik",
  masonry: "grill",
  chimney: "komin",
  clearance: "strefa komina"
};
