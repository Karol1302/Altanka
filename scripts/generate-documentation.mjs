import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const root = process.cwd();
const spec = JSON.parse(fs.readFileSync(path.join(root, "structure_spec_v13.json"), "utf8"));
const publicDir = path.join(root, "public");
const outRoot = path.join(root, "Altanka_dokumentacja.pdf");
const outPublic = path.join(publicDir, "Altanka_dokumentacja.pdf");
fs.mkdirSync(publicDir, { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 38, right: 38, bottom: 42, left: 38 },
  info: {
    Title: "Altanka - dokumentacja konstrukcji",
    Author: "Codex",
    Subject: "Dokumentacja altanki drewnianej"
  }
});

const stream = fs.createWriteStream(outRoot);
doc.pipe(stream);

const regularCandidates = [
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
];
const boldCandidates = [
  "C:/Windows/Fonts/arialbd.ttf",
  "C:/Windows/Fonts/Arialbd.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
];
const regularFont = regularCandidates.find((font) => fs.existsSync(font));
const boldFont = boldCandidates.find((font) => fs.existsSync(font));
if (regularFont) doc.registerFont("Regular", regularFont);
if (boldFont) doc.registerFont("Bold", boldFont);
const F = regularFont ? "Regular" : "Helvetica";
const FB = boldFont ? "Bold" : "Helvetica-Bold";

const g = spec.global;
const e = spec.elements;
const W = doc.page.width;
const H = doc.page.height;
const M = 38;
const CW = W - 2 * M;

const C = {
  ink: "#1f2429",
  muted: "#5c6570",
  pale: "#f3f5f7",
  line: "#1f2429",
  dim: "#6f7882",
  post: "#7c6658",
  beam: "#5d4337",
  rafter: "#d66a00",
  tie: "#2f7d3d",
  ridge: "#5e237a",
  braceA: "#bb2f35",
  braceB: "#2368aa",
  metal: "#9aa2a8",
  wall: "#8b7465",
  masonry: "#9b5f3d",
  chimney: "#aeb6bd",
  osb: "#bf8b56",
  roof: "#113f25",
  wind: "#7653c4",
  snow: "#3e9ed8"
};

const roofArea = 2 * (e.rafters.axis_length / 100) * (g.roof_length / 100);
const roofPlanArea = (g.roof_width_with_overhang / 100) * (g.roof_length / 100);
const deadQ = 0.242;
const osbQ = (0.018 * 650 * 9.81) / 1000;
const papaQ = (2.5 * 9.81) / 1000;
const shingleQ = (10 * 9.81) / 1000;
const accessoryQ = Math.max(deadQ - osbQ - papaQ - shingleQ, 0);
const snowQ = 1.28;
const snowExtremeQ = 1.6;
const upliftMinQ = 0.8;
const upliftMaxQ = 1.0;
const windWallQ = 0.8;
const kgPerKn = 101.97;
const deadTotal = roofArea * deadQ;
const snowTotal = roofArea * snowQ;
const snowExtremeTotal = roofArea * snowExtremeQ;
const upliftMin = roofArea * upliftMinQ;
const upliftMax = roofArea * upliftMaxQ;
const rearWall = { width: 3.72, height: 2.5, thickness: 0.01 };
const sideWall = { width: 5.72, height: 2.5, thickness: 0.01 };
const rearArea = rearWall.width * rearWall.height;
const sideArea = sideWall.width * sideWall.height;
const wallArea = rearArea + sideArea;
const wallVolume = wallArea * rearWall.thickness;
const wallMass = wallVolume * 450;
const wallMassWithFrame = wallMass + 55;
const rearWind = rearArea * windWallQ;
const sideWind = sideArea * windWallQ;
const rearMoment = rearWind * (rearWall.height / 2);
const sideMoment = sideWind * (sideWall.height / 2);

function fmt(value, digits = 1) {
  return value.toFixed(digits).replace(".", ",");
}

function pageTitle(title, subtitle) {
  doc.font(FB).fontSize(20).fillColor(C.ink).text(title, M, 48, { width: CW });
  if (subtitle) doc.font(F).fontSize(10).fillColor(C.muted).text(subtitle, M, 78, { width: CW, lineGap: 2 });
}

function header(title) {
  doc.font(FB).fontSize(9).fillColor(C.muted).text("Altanka", M, 20);
  doc.font(FB).fontSize(15).fillColor(C.ink).text(title, M, 46);
  doc.moveTo(M, 68).lineTo(W - M, 68).strokeColor("#cfd6dd").lineWidth(0.7).stroke();
}

function addPage(title) {
  doc.addPage();
  header(title);
}

function section(title, y) {
  doc.font(FB).fontSize(12).fillColor(C.ink).text(title, M, y);
  doc.moveTo(M, y + 17).lineTo(W - M, y + 17).strokeColor("#d7dde4").lineWidth(0.5).stroke();
  return y + 28;
}

function p(text, x, y, width = CW, size = 9.2) {
  doc.font(F).fontSize(size).fillColor(C.ink).text(text, x, y, { width, lineGap: 2 });
  return doc.y + 8;
}

function small(text, x, y, width, color = C.muted) {
  doc.font(F).fontSize(7.5).fillColor(color).text(text, x, y, { width, lineGap: 1 });
}

function label(text, x, y, color = C.ink) {
  doc.font(FB).fontSize(7.5).fillColor(color).text(text, x, y);
}

function bullet(items, x, y, width = CW) {
  doc.font(F).fontSize(8.5).fillColor(C.ink);
  items.forEach((item) => {
    doc.circle(x + 3, y + 5, 1.4).fill(C.ink);
    doc.fillColor(C.ink).text(item, x + 12, y, { width: width - 12, lineGap: 1.4 });
    y = doc.y + 4;
  });
  return y + 3;
}

function table(headers, rows, x, y, widths, options = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const h = options.headerHeight ?? 20;
  doc.rect(x, y, total, h).fill("#e9eef3");
  let cx = x;
  headers.forEach((item, i) => {
    doc.font(FB).fontSize(7.7).fillColor(C.ink).text(item, cx + 4, y + 6, { width: widths[i] - 8 });
    cx += widths[i];
  });
  y += h;
  rows.forEach((row, idx) => {
    const rowH = Math.max(options.rowHeight ?? 20, ...row.map((cell, i) => doc.heightOfString(String(cell), { width: widths[i] - 8 }) + 10));
    doc.rect(x, y, total, rowH).fill(idx % 2 ? "#ffffff" : "#f8fafc");
    doc.rect(x, y, total, rowH).strokeColor("#d8dee6").lineWidth(0.35).stroke();
    let rx = x;
    row.forEach((cell, i) => {
      doc.font(F).fontSize(7.7).fillColor(C.ink).text(String(cell), rx + 4, y + 5, { width: widths[i] - 8, lineGap: 1 });
      rx += widths[i];
    });
    y += rowH;
  });
  return y + 10;
}

function dim(x1, y1, x2, y2, text, tx = 0, ty = 0) {
  doc.strokeColor(C.dim).lineWidth(0.5).moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.moveTo(x1 - 4, y1 - 4).lineTo(x1 + 4, y1 + 4).stroke();
  doc.moveTo(x2 - 4, y2 - 4).lineTo(x2 + 4, y2 + 4).stroke();
  doc.font(FB).fontSize(7).fillColor(C.dim).text(text, (x1 + x2) / 2 - 35 + tx, (y1 + y2) / 2 - 5 + ty, { width: 70, align: "center" });
}

function arrow(x1, y1, x2, y2, color, text) {
  doc.strokeColor(color).fillColor(color).lineWidth(1.5).moveTo(x1, y1).lineTo(x2, y2).stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 6;
  doc
    .path(`M ${x2} ${y2} L ${x2 - head * Math.cos(angle - 0.5)} ${y2 - head * Math.sin(angle - 0.5)} L ${x2 - head * Math.cos(angle + 0.5)} ${y2 - head * Math.sin(angle + 0.5)} Z`)
    .fill(color);
  if (text) label(text, x2 + 4, y2 - 4, color);
}

function drawFrontElevation(x, y, w, h) {
  const minX = -60;
  const maxX = 460;
  const maxZ = 390;
  const s = Math.min(w / (maxX - minX), h / maxZ);
  const P = (xx, zz) => [x + (xx - minX) * s, y + h - zz * s];

  doc.rect(x, y, w, h).fill("#fbfcfd").strokeColor("#d9e0e7").stroke();
  doc.lineWidth(1.2).strokeColor(C.rafter).moveTo(...P(-50, g.eave_z)).lineTo(...P(200, g.ridge_z)).lineTo(...P(450, g.eave_z)).stroke();
  doc.lineWidth(10 * s).strokeColor(C.rafter).moveTo(...P(-45, g.eave_z + 3)).lineTo(...P(200, g.ridge_z)).lineTo(...P(445, g.eave_z + 3)).stroke();
  [0, 386].forEach((xx) => {
    const [px, py] = P(xx, 0);
    doc.rect(px, py - 250 * s, 14 * s, 250 * s).fill(C.post).stroke(C.line);
  });
  let [bx, by] = P(0, 250);
  doc.rect(bx, by - 14 * s, 400 * s, 14 * s).fill(C.beam).stroke(C.line);
  [bx, by] = P(e.ties_J.bottom_length ? 110.8 : 110.8, e.ties_J.z_bottom);
  doc.rect(bx, by - 7 * s, 178.4 * s, 7 * s).fill(C.tie).stroke(C.line);
  [bx, by] = P(e.BK.position.x, e.BK.position.z);
  doc.rect(bx, by - 7 * s, 7 * s, 7 * s).fill(C.ridge).stroke(C.line);
  doc.lineWidth(7 * s).strokeColor(C.braceA).moveTo(...P(14, 208)).lineTo(...P(75, 250)).stroke();
  doc.moveTo(...P(386, 208)).lineTo(...P(325, 250)).stroke();
  doc.lineWidth(0.5).strokeColor(C.dim);
  dim(...P(0, -16), ...P(400, -16), "400 cm");
  dim(...P(430, 0), ...P(430, g.ridge_z), "336,8 cm", 22, 0);
  label("jętka", ...P(180, 308), C.tie);
  label("BK", ...P(207, 328), C.ridge);
}

function drawSideElevation(x, y, w, h, withWall = false) {
  const minY = -30;
  const maxY = 630;
  const maxZ = 390;
  const s = Math.min(w / (maxY - minY), h / maxZ);
  const P = (yy, zz) => [x + (yy - minY) * s, y + h - zz * s];
  doc.rect(x, y, w, h).fill("#fbfcfd").strokeColor("#d9e0e7").stroke();
  [0, 293, 586].forEach((yy) => {
    const [px, py] = P(yy, 0);
    doc.rect(px, py - 250 * s, 14 * s, 250 * s).fill(C.post).stroke(C.line);
  });
  let [px, py] = P(0, 250);
  doc.rect(px, py - 14 * s, 600 * s, 14 * s).fill(C.beam).stroke(C.line);
  [px, py] = P(0, e.BK.position.z);
  doc.rect(px, py - 7 * s, 600 * s, 7 * s).fill(C.ridge).stroke(C.line);
  e.rafters.y_positions.forEach((yy) => {
    const [rx, ry] = P(yy, 340);
    doc.rect(rx - 3 * s, ry - 95 * s, 7 * s, 95 * s).fill(C.rafter).stroke(C.line);
  });
  doc.lineWidth(7 * s).strokeColor(C.braceA).moveTo(...P(14, 208)).lineTo(...P(70, 250)).stroke();
  doc.moveTo(...P(293, 208)).lineTo(...P(237, 250)).stroke();
  doc.moveTo(...P(307, 250)).lineTo(...P(363, 208)).stroke();
  doc.moveTo(...P(586, 208)).lineTo(...P(530, 250)).stroke();
  if (withWall) {
    const [wx, wy] = P(14, 0);
    doc.rect(wx, wy - 250 * s, 572 * s, 250 * s).fillOpacity(0.6).fill(C.wall).fillOpacity(1).stroke(C.line);
    [110, 220, 380, 500].forEach((yy) => {
      const [sx, sy] = P(yy, 0);
      doc.rect(sx, sy - 250 * s, 8 * s, 250 * s).fill(C.beam).stroke(C.line);
    });
    label("ściana boczna do wieńca", ...P(165, 242), C.wall);
  }
  const [gx, gy] = P(512, 0);
  doc.rect(gx, gy - 115 * s, 80 * s, 115 * s).fill(C.masonry).stroke(C.line);
  const [chx, chy] = P(529.5, 115);
  doc.rect(chx, chy - 262 * s, 45 * s, 262 * s).fill(C.chimney).stroke(C.line);
  dim(...P(0, -16), ...P(600, -16), "600 cm");
}

function drawTopPlan(x, y, w, h, withWalls = false) {
  const minX = -70;
  const maxX = 470;
  const minY = -50;
  const maxY = 660;
  const s = Math.min(w / (maxX - minX), h / (maxY - minY));
  const P = (xx, yy) => [x + (xx - minX) * s, y + (yy - minY) * s];
  doc.rect(x, y, w, h).fill("#fbfcfd").strokeColor("#d9e0e7").stroke();
  let [px, py] = P(-50, 0);
  doc.rect(px, py, 500 * s, 600 * s).fillOpacity(0.08).fill(C.roof).fillOpacity(1).strokeColor(C.roof).stroke();
  [px, py] = P(0, 0);
  doc.rect(px, py, 400 * s, 600 * s).lineWidth(1.1).strokeColor(C.beam).stroke();
  e.rafters.y_positions.forEach((yy) => {
    const [x1, y1] = P(-50, yy);
    const [x2] = P(450, yy);
    doc.lineWidth(1.5).strokeColor(C.rafter).moveTo(x1, y1).lineTo(x2, y1).stroke();
  });
  const [rx, ry1] = P(200, 0);
  const [, ry2] = P(200, 600);
  doc.lineWidth(2).strokeColor(C.ridge).moveTo(rx, ry1).lineTo(rx, ry2).stroke();
  Object.values(e.posts.positions_xy_lower_left).forEach(([xx, yy]) => {
    const [sx, sy] = P(xx, yy);
    doc.rect(sx, sy, 14 * s, 14 * s).fill(C.post).stroke(C.line);
  });
  [[14, 14, 70, 70], [386, 14, 330, 70], [14, 586, 70, 530], [386, 586, 330, 530]].forEach(([x1, y1, x2, y2]) => {
    doc.lineWidth(4 * s).strokeColor(C.braceB).moveTo(...P(x1, y1)).lineTo(...P(x2, y2)).stroke();
  });
  const [gx, gy] = P(140, 512);
  doc.rect(gx, gy, 120 * s, 80 * s).fill(C.masonry).stroke(C.line);
  const [cx, cy] = P(171, 529.5);
  doc.rect(cx, cy, 58 * s, 45 * s).fill(C.chimney).stroke(C.line);
  const [clx, cly] = P(163, 521.5);
  doc.rect(clx, cly, 74 * s, 61 * s).strokeColor(C.braceA).lineWidth(0.8).stroke();
  if (withWalls) {
    let [wx, wy] = P(14, 600);
    doc.rect(wx, wy - 8 * s, 372 * s, 8 * s).fill(C.wall).stroke(C.line);
    [70, 160, 240, 330].forEach((xx) => {
      const [sx, sy] = P(xx, 594);
      doc.rect(sx, sy, 8 * s, 18 * s).fill(C.beam).stroke(C.line);
    });
    [wx, wy] = P(0, 14);
    doc.rect(wx, wy, 8 * s, 572 * s).fill(C.wall).stroke(C.line);
    [110, 220, 380, 500].forEach((yy) => {
      const [sx, sy] = P(-6, yy);
      doc.rect(sx, sy, 18 * s, 8 * s).fill(C.beam).stroke(C.line);
    });
  }
  dim(...P(0, 632), ...P(400, 632), "400 cm");
  dim(...P(-50, 650), ...P(450, 650), "dach 500 cm");
  dim(...P(-58, 0), ...P(-58, 600), "600 cm", -14, 0);
}

function legend(x, y) {
  const rows = [
    [C.post, "słupy"],
    [C.beam, "wieniec / belki"],
    [C.rafter, "krokwie"],
    [C.tie, "jętki i podpory"],
    [C.ridge, "BK"],
    [C.braceA, "zastrzały A"],
    [C.braceB, "zastrzały B"],
    [C.wall, "ściany drewniane"],
    [C.chimney, "komin"],
    [C.masonry, "grill"]
  ];
  doc.font(FB).fontSize(10).fillColor(C.ink).text("Legenda", x, y);
  y += 18;
  rows.forEach(([color, text]) => {
    doc.rect(x, y + 2, 13, 8).fill(color);
    small(text, x + 19, y, 92, C.ink);
    y += 15;
  });
}

pageTitle("Altanka 400 × 600 cm", "Dokumentacja poglądowo-wykonawcza konstrukcji drewnianej z dachem dwuspadowym, grillem, kominem niezależnym oraz planowanymi ścianami drewnianymi.");

let y = 125;
y = table(
  ["Parametr", "Wartość"],
  [
    ["Obrys słupów i wieńca", "400 × 600 cm"],
    ["Dach z okapem", "500 × 600 cm"],
    ["Kąt dachu", "20°"],
    ["Wysokość słupów", "250 cm"],
    ["Góra wieńca", "264 cm"],
    ["Wysokość kalenicy", "336,8 cm"],
    ["Rozstaw krokwi", "84,7 cm modułowo"],
    ["Światło między krokwiami", "77,7 cm"]
  ],
  M,
  y,
  [210, 300],
  { rowHeight: 22 }
);
y = section("Założenia ogólne", y + 4);
y = bullet(
  [
    "konstrukcja drewniana bez ścian pełnych w części frontowej",
    "komin jest niezależny i nie może przenosić obciążeń z dachu",
    "ściana tylna i ściana boczna po drugim długim boku są traktowane jako poszycie poglądowe oraz powierzchnie łapiące wiatr",
    "wartości obciążeń są robocze i służą do oceny skali sił; finalne przekroje i kotwy wymagają sprawdzenia dla lokalizacji"
  ],
  M,
  y + 4
);
y = section("Najważniejsze ryzyka do dopracowania", y + 4);
bullet(
  [
    "kotwienie słupów do fundamentu oraz przeniesienie sił poziomych od ścian",
    "mocowanie krokwi i dachu na ssanie wiatru",
    "detal komina: dylatacja, szczelna obróbka i brak sztywnego spięcia z drewnem",
    "ściany dochodzą do wieńca; przestrzeń powyżej wieńca i między krokwiami zostaje otwarta dla wentylacji i wyrównania ciśnienia"
  ],
  M,
  y + 4
);

addPage("Rzuty i widoki konstrukcji");
drawTopPlan(46, 92, 250, 330, true);
drawFrontElevation(318, 92, 230, 175);
drawSideElevation(318, 326, 230, 170, true);
legend(46, 456);

addPage("Widoki ścian i usztywnień");
drawFrontElevation(50, 92, 500, 245);
doc.font(FB).fontSize(10).fillColor(C.ink).text("Widok poprzeczny: krokwie, wieniec, zastrzały A, jętka i BK", 50, 348);
drawSideElevation(50, 410, 500, 245, true);
doc.font(FB).fontSize(10).fillColor(C.ink).text("Widok boczny: słupy, zastrzały A, krokwie i ściana boczna jako warstwa", 50, 666);

addPage("Materiały i warstwy");
y = 88;
y = table(
  ["Element", "Materiał / wymiar", "Rola i uwagi"],
  [
    ["Słupy", "sosna C18, 14 × 14 cm", "elementy pionowe; wymagają dobrych podstaw i kotwienia"],
    ["Wieniec", "świerk C24, 14 × 14 cm", "zamyka ramę na górze i odbiera krokwie oraz zastrzały"],
    ["Krokwie", "świerk C24, 7 × 14 cm", "8 par, dach 20°, długość osiowa ok. 266 cm"],
    ["Jętki i podpory P", "świerk C24, 7 × 7 cm", "spinają układ krokwi i podpierają jętki na froncie oraz tyle"],
    ["BK", "świerk C24, 7 × 7 cm", "belka podkalenicowa pod stykiem krokwi"],
    ["Zastrzały A/B", "sosna C18", "usztywnienie słup-wieniec oraz narożników wieńca"],
    ["OSB", "OSB-3, zalecane 18 mm", "sztywna warstwa pod papę i gont; mocowanie wg systemu producenta"],
    ["Papa + gont", "zielony gont bitumiczny", "warstwa pokrycia, wymaga obróbek i wentylacji"],
    ["Ściany drewniane", "deska pióro-wpust ok. 10 mm", "traktować jako okładzinę, nie jako główną tarczę usztywniającą"],
    ["Komin", "murowany, niezależny", "oddzielony od drewna, obrobiony blachą w sposób pozwalający na ruch"]
  ],
  M,
  y,
  [105, 135, 270],
  { rowHeight: 24 }
);
y = section("Analiza materiałowa", y + 2);
bullet(
  [
    "C24 dla wieńca i krokwi jest właściwszy od słabszego drewna przy elementach pracujących na zginanie.",
    "Deska pióro-wpust 10 mm może pełnić rolę osłonową, ale nie powinna być liczona jako pełnoprawna ściana usztywniająca bez projektu łączników i poszycia.",
    "Jeżeli ściany mają realnie usztywniać konstrukcję, lepsze jest poszycie konstrukcyjne OSB/sklejka lub zaprojektowane stężenia krzyżowe.",
    "Metalowe złącza powinny być ocynkowane i dobrane do środowiska zewnętrznego oraz konkretnej liczby wkrętów/śrub."
  ],
  M,
  y + 4
);

addPage("Ściany drewniane i wiatr");
y = 88;
y = p("Planowana ściana tylna od północy oraz ściana boczna po drugim długim boku zwiększają osłonę, ale przy wietrze pracują jak żagiel. Dlatego powinny być traktowane jako dodatkowe powierzchnie odbierające parcie wiatru i przekazujące siły do słupów, wieńca, belki dolnej oraz fundamentu. Ściany w tym wariancie dochodzą od ziemi do wieńca, bez zabudowy trójkątów nad wieńcem.", M, y);
y = table(
  ["Ściana", "Przyjęty wymiar", "Powierzchnia", "Masa desek 10 mm", "Siła przy 0,8 kN/m²"],
  [
    ["tył / północ", "3,72 × 2,50 m", `${fmt(rearArea)} m²`, `${fmt(rearArea * 0.01 * 450)} kg`, `${fmt(rearWind)} kN`],
    ["drugi długi bok", "5,72 × 2,50 m", `${fmt(sideArea)} m²`, `${fmt(sideArea * 0.01 * 450)} kg`, `${fmt(sideWind)} kN`],
    ["razem", "-", `${fmt(wallArea)} m²`, `${fmt(wallMass)} kg + ok. 55 kg ramy`, "zależnie od kierunku wiatru"]
  ],
  M,
  y + 8,
  [90, 110, 85, 105, 120],
  { rowHeight: 24 }
);
y = section("Wnioski dla ścian", y + 4);
bullet(
  [
    `dla ściany tylnej parcie rzędu 0,8 kN/m² daje około ${fmt(rearWind)} kN siły poziomej i około ${fmt(rearMoment)} kNm momentu wywracającego`,
    `dla ściany bocznej ta sama wartość daje około ${fmt(sideWind)} kN i około ${fmt(sideMoment)} kNm`,
    "otwarta przestrzeń powyżej wieńca pomaga wyrównać ciśnienie i osuszać przegrodę, ale nie zastępuje kotwienia słupów i mocowania dachu",
    "dodatkowe otwory w samych ścianach nie są konieczne na tym etapie; ważniejsze jest zostawienie strefy nad wieńcem i zapewnienie mocnych połączeń",
    "zalecane są dodatkowe słupki pomocnicze, belka dolna, górny rygiel, wkręty nierdzewne/ocynkowane oraz przeniesienie sił do głównych słupów"
  ],
  M,
  y + 4
);

addPage("Ręczne obliczenia obciążeń");
y = 88;
y = p("Poniżej zapisano rachunek tak, jak można go prześledzić ręcznie: najpierw geometria dachu, potem obciążenia jednostkowe warstw i dopiero na końcu siły całkowite. Przeliczenie orientacyjne: 1 kN ≈ 101,97 kg siły.", M, y);
y = table(
  ["Krok", "Obliczenie", "Wynik"],
  [
    ["Powierzchnia połaci", "2 × 2,660 m × 6,000 m", `${fmt(roofArea, 2)} m²`],
    ["Powierzchnia rzutu dachu", "5,000 m × 6,000 m", `${fmt(roofPlanArea, 2)} m²`],
    ["OSB 18 mm", "0,018 m × 650 kg/m³ × 9,81 / 1000", `${fmt(osbQ, 3)} kN/m²`],
    ["Papa", "2,5 kg/m² × 9,81 / 1000", `${fmt(papaQ, 3)} kN/m²`],
    ["Gont bitumiczny", "10 kg/m² × 9,81 / 1000", `${fmt(shingleQ, 3)} kN/m²`],
    ["Zapas na mocowania/warstwy", `0,242 - ${fmt(osbQ + papaQ + shingleQ, 3)}`, `${fmt(accessoryQ, 3)} kN/m²`],
    ["Suma stała dachu", `${fmt(osbQ, 3)} + ${fmt(papaQ, 3)} + ${fmt(shingleQ, 3)} + ${fmt(accessoryQ, 3)}`, `${fmt(deadQ, 3)} kN/m²`],
    ["Ciężar stały całkowity", `${fmt(roofArea, 2)} m² × ${fmt(deadQ, 3)} kN/m²`, `${fmt(deadTotal, 2)} kN ≈ ${fmt(deadTotal * kgPerKn, 0)} kg`],
    ["Śnieg ciężki", `${fmt(roofArea, 2)} m² × 1,28 kN/m²`, `${fmt(snowTotal, 2)} kN ≈ ${fmt(snowTotal * kgPerKn, 0)} kg`],
    ["Śnieg bardzo ciężki", `${fmt(roofArea, 2)} m² × 1,60 kN/m²`, `${fmt(snowExtremeTotal, 2)} kN ≈ ${fmt(snowExtremeTotal * kgPerKn, 0)} kg`],
    ["Ssanie wiatru na połaciach", `${fmt(roofArea, 2)} m² × 0,8 do 1,0 kN/m²`, `${fmt(upliftMin, 2)}-${fmt(upliftMax, 2)} kN`]
  ],
  M,
  y + 8,
  [118, 245, 147],
  { rowHeight: 21 }
);

addPage("Obliczenia wiatru i ścian");
y = 88;
y = p("Pełne ściany działają przy wietrze jak powierzchnie chwytające napór. W rachunku poglądowym przyjęto 0,8 kN/m² i środek parcia w połowie wysokości ściany, czyli 1,25 m nad podstawą.", M, y);
y = table(
  ["Element", "Rachunek ręczny", "Wynik"],
  [
    ["Ściana tylna: pole", "3,72 m × 2,50 m", `${fmt(rearArea, 2)} m²`],
    ["Ściana tylna: parcie", `${fmt(rearArea, 2)} m² × 0,8 kN/m²`, `${fmt(rearWind, 2)} kN`],
    ["Ściana tylna: moment", `${fmt(rearWind, 2)} kN × 1,25 m`, `${fmt(rearMoment, 2)} kNm`],
    ["Ściana boczna: pole", "5,72 m × 2,50 m", `${fmt(sideArea, 2)} m²`],
    ["Ściana boczna: parcie", `${fmt(sideArea, 2)} m² × 0,8 kN/m²`, `${fmt(sideWind, 2)} kN`],
    ["Ściana boczna: moment", `${fmt(sideWind, 2)} kN × 1,25 m`, `${fmt(sideMoment, 2)} kNm`],
    ["Masa desek", `${fmt(wallArea, 2)} m² × 0,010 m × 450 kg/m³`, `${fmt(wallMass, 0)} kg`],
    ["Masa z ramą", `${fmt(wallMass, 0)} kg + ok. 55 kg`, `${fmt(wallMassWithFrame, 0)} kg`]
  ],
  M,
  y + 8,
  [122, 243, 145],
  { rowHeight: 24 }
);
y = section("Interpretacja", y + 4);
bullet(
  [
    "śnieg jest największym obciążeniem pionowym w tej wizualizacji i może wielokrotnie przekraczać ciężar samego pokrycia",
    "ssanie wiatru wymaga szczególnej uwagi przy mocowaniu krokwi, OSB/pokrycia oraz kotwieniu słupów",
    "ściany drewniane zwiększają boczne obciążenie konstrukcji, więc nie powinny być dodawane bez kontroli kotew i stężeń",
    "siły poziome ze ścian trzeba sprowadzić przez słupki, rygle, główne słupy i kotwy do fundamentu",
    "komin nie jest podporą i nie zmniejsza obciążeń dachu"
  ],
  M,
  y + 4
);
arrow(95, 646, 95, 600, C.snow, "śnieg / ciężar");
arrow(220, 646, 220, 600, C.rafter, "pokrycie");
arrow(365, 612, 455, 612, C.wind, "wiatr");
arrow(500, 630, 500, 585, "#cf4d8f", "ssanie");

addPage("Złącza, kotwy i komin");
y = 88;
y = table(
  ["Miejsce", "Zalecenie poglądowe", "Co sprawdzić"],
  [
    ["Podstawy słupów", "regulowane podstawy stalowe lub U/H, kotwione do fundamentu", "średnica i głębokość kotew, odporność na wyrwanie i siły poziome"],
    ["Słup-wieniec", "kątowniki/ciesielskie złącza po obu stronach oraz śruby/wkręty konstrukcyjne", "liczbę łączników, odległości od krawędzi, docisk zastrzałów"],
    ["Zastrzały A/B", "śruby z podkładkami lub wkręty konstrukcyjne w obu końcach", "przeniesienie ścinania i pracy na rozciąganie/ściskanie"],
    ["Krokwie-wieniec", "łączniki przeciw podrywaniu, np. taśmy/kątowniki ciesielskie", "ssanie wiatru i ciągłość połączenia do słupa/fundamentu"],
    ["OSB i pokrycie", "mocowanie zgodne z systemem i rozstawem wkrętów/gwoździ", "brzegi płyt, dylatacje, wodoodporność i wentylację"],
    ["Ściany drewniane", "deski do słupków pomocniczych, słupki do rygli i głównych słupów", "żagiel wiatrowy, belkę dolną, odprowadzenie wody i kotwienie"],
    ["Komin", "dwuczęściowa obróbka: część przy dachu + kontr-obróbka przy kominie", "szczelność, ruch względny dachu i komina, materiał niepalny"]
  ],
  M,
  y,
  [92, 250, 168],
  { rowHeight: 28 }
);
y = section("Detal komina", y + 4);
y = bullet(
  [
    "dach może minimalnie pracować pod obciążeniem, a komin murowany powinien pozostać niezależny; nie należy go sztywno spinać z krokwiami ani BK",
    "wokół komina należy zachować dylatację i strefę bez drewna, a przestrzeń rozwiązać materiałem niepalnym i obróbką blacharską",
    "profesjonalny detal to baza/stopnie obróbki połączone z dachem oraz kontr-obróbka mocowana do komina; elementy zachodzą na siebie, ale nie tworzą jednego sztywnego mostka",
    "od strony wyższej połaci warto przewidzieć siodełko/odbój wody, żeby nie stała za kominem",
    "uszczelniacze traktować jako dodatek, nie jako główne zabezpieczenie przed wodą"
  ],
  M,
  y + 4
);
y = section("Praktyczne dobre praktyki", y + 4);
bullet(
  [
    "nie opierać dachu na kominie i nie usuwać dylatacji przy kominie",
    "nie liczyć cienkiej okładziny pióro-wpust jako głównego usztywnienia bez osobnego projektu",
    "zapewnić ciągłość drogi sił: dach → krokwie → wieniec → słupy → kotwy → fundament",
    "dla ścian pełnych przewidzieć dodatkowe stężenie, mocniejsze kotwienie i kontrolę wyrwania od wiatru",
    "złącza dobrać katalogowo do realnych obciążeń i konkretnego typu drewna"
  ],
  M,
  y + 4
);

doc.end();
await new Promise((resolve) => stream.on("finish", resolve));
fs.copyFileSync(outRoot, outPublic);
console.log(`Generated ${outRoot}`);
console.log(`Copied ${outPublic}`);
