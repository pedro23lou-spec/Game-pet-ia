import type {
  FurnitureCatalogItem,
  FurnitureType,
  GardenPlot,
  PetAppearance,
  PlacedFurniture,
  SeedType,
  TimeOfDay,
  Vec2,
  WallRect,
  WorkGig,
  ZoneArea,
} from '../types/game';

export const WORLD_WIDTH = 1400;
export const WORLD_HEIGHT = 1000;
export const NAV_CELL_SIZE = 40;
export const NAV_COLS = WORLD_WIDTH / NAV_CELL_SIZE; // 35
export const NAV_ROWS = WORLD_HEIGHT / NAV_CELL_SIZE; // 25

export const WORK_GATE = {
  x: 1356,
  y: 520,
  approachX: 1300,
  approachY: 520,
  radius: 40,
};

export const DEFAULT_APPEARANCE: PetAppearance = {
  primaryColor: '#FFE3BF',
  secondaryColor: '#F6C08E',
  accentColor: '#E07A5F',
  bodyShape: 'round',
  earStyle: 'floppy',
  eyeStyle: 'round',
  accessory: 'none',
  descriptionPrompt: 'Bichinho clássico aconchegante cor de caramelo',
};

export const FURNITURE_CATALOG: Record<FurnitureType, FurnitureCatalogItem> = {
  fridge: {
    type: 'fridge',
    name: 'Geladeira / Tigela',
    shortName: 'Geladeira',
    description: 'Armazena comida para o pet comer quando sentir fome.',
    radius: 30,
    price: 55,
  },
  mat: {
    type: 'mat',
    name: 'Colchonete Simples',
    shortName: 'Colchonete',
    description: 'Um colchonete básico para descansar.',
    radius: 32,
    price: 25,
  },
  bed: {
    type: 'bed',
    name: 'Cama Macia',
    shortName: 'Cama Macia',
    description: 'Super confortável! Recupera Energia e Energia Mental muito mais rápido.',
    radius: 36,
    price: 70,
  },
  easel: {
    type: 'easel',
    name: 'Cavalete de Pintura',
    shortName: 'Cavalete',
    description: 'Desbloqueia desenhos autônomos criados com criatividade real.',
    radius: 30,
    price: 60,
  },
  computer: {
    type: 'computer',
    name: 'Computador com Internet',
    shortName: 'Computador',
    description: 'Jogos, vídeos, pesquisas reais e até coisas suspeitas.',
    radius: 32,
    price: 90,
  },
  diary: {
    type: 'diary',
    name: 'Diário Secreto',
    shortName: 'Diário',
    description: 'O pet escreve segredos sinceros sobre você. Cuidado ao ler escondido!',
    radius: 28,
    price: 30,
  },
  ball: {
    type: 'ball',
    name: 'Bola de Futebol',
    shortName: 'Bola',
    description: 'Melhora a Saúde do pet e libera o minigame de pênaltis!',
    radius: 22,
    price: 35,
  },
};

export interface SeedInfo {
  type: SeedType;
  name: string;
  price: number;
  growthSeconds: number;
  description: string;
}

export const SEED_CATALOG: Record<SeedType, SeedInfo> = {
  carrot: {
    type: 'carrot',
    name: 'Semente de Cenoura',
    price: 12,
    growthSeconds: 22,
    description: 'Alimento natural: +30 Fome e +15 Saúde quando o pet colher.',
  },
  tomato: {
    type: 'tomato',
    name: 'Semente de Tomate',
    price: 15,
    growthSeconds: 26,
    description: 'Alimento suculento: +35 Fome e +18 Saúde.',
  },
  sunflower: {
    type: 'sunflower',
    name: 'Semente de Girassol',
    price: 18,
    growthSeconds: 24,
    description: 'Flor radiante: +20 Inspiração e +14 Energia Mental ao admirar.',
  },
};

export const WORK_GIGS: WorkGig[] = [
  {
    id: 'delivery',
    title: 'Entregador de Bicicleta',
    durationSec: 45,
    rewardCoins: 14,
    energyCost: 14,
    mentalCost: 6,
    healthDelta: 6,
    traitBoost: 'trabalhador',
  },
  {
    id: 'cafe',
    title: 'Ajudante de Café',
    durationSec: 65,
    rewardCoins: 20,
    energyCost: 12,
    mentalCost: 10,
    healthDelta: 0,
    traitBoost: 'carinhoso',
  },
  {
    id: 'freelancer',
    title: 'Freelancer Digital',
    durationSec: 85,
    rewardCoins: 28,
    energyCost: 10,
    mentalCost: 16,
    healthDelta: -2,
    traitBoost: 'nerd',
  },
];

export const DEFAULT_GARDEN_PLOTS: GardenPlot[] = [
  { id: 'plot-1', x: 970, y: 760, seed: null, stage: 0, watered: false, growthProgress: 0 },
  { id: 'plot-2', x: 1090, y: 760, seed: null, stage: 0, watered: false, growthProgress: 0 },
  { id: 'plot-3', x: 1210, y: 760, seed: null, stage: 0, watered: false, growthProgress: 0 },
];

export const DEFAULT_FURNITURE: PlacedFurniture[] = [
  {
    id: 'starter-fridge',
    type: 'fridge',
    x: 795,
    y: 145,
    foodStock: 2,
    maxFoodStock: 4,
  },
  {
    id: 'starter-mat',
    type: 'mat',
    x: 165,
    y: 175,
    foodStock: 0,
    maxFoodStock: 0,
  },
  {
    id: 'starter-diary',
    type: 'diary',
    x: 375,
    y: 155,
    foodStock: 0,
    maxFoodStock: 0,
  },
];

export const ZONES: ZoneArea[] = [
  {
    id: 'yard',
    label: 'Quintal',
    floor: 'grass',
    x: 0,
    y: 0,
    w: WORLD_WIDTH,
    h: WORLD_HEIGHT,
  },
  {
    id: 'bedroom',
    label: 'Quarto',
    floor: 'wood-cozy',
    x: 80,
    y: 80,
    w: 380,
    h: 400,
  },
  {
    id: 'kitchen',
    label: 'Cozinha',
    floor: 'tile-kitchen',
    x: 460,
    y: 80,
    w: 400,
    h: 400,
  },
  {
    id: 'living',
    label: 'Sala de Estar',
    floor: 'wood-warm',
    x: 80,
    y: 480,
    w: 780,
    h: 440,
  },
];

export const WALLS: WallRect[] = [
  { x: 72, y: 72, w: 796, h: 20 },
  { x: 72, y: 72, w: 20, h: 856 },
  { x: 72, y: 912, w: 796, h: 20 },
  { x: 852, y: 72, w: 20, h: 488 },
  { x: 852, y: 720, w: 20, h: 212 },

  { x: 452, y: 88, w: 16, h: 132 },
  { x: 452, y: 340, w: 16, h: 140 },

  { x: 88, y: 472, w: 122, h: 16 },
  { x: 330, y: 472, w: 130, h: 16 },

  { x: 460, y: 472, w: 100, h: 16 },
  { x: 720, y: 472, w: 140, h: 16 },
];

export interface StaticObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'pond' | 'sofa' | 'counter' | 'bookshelf' | 'table';
}

export const STATIC_OBSTACLES: StaticObstacle[] = [
  { x: 540, y: 98, w: 240, h: 52, kind: 'counter' },
  { x: 130, y: 635, w: 68, h: 170, kind: 'sofa' },
  { x: 245, y: 685, w: 56, h: 78, kind: 'table' },
  { x: 500, y: 854, w: 140, h: 46, kind: 'bookshelf' },
  { x: 1060, y: 200, w: 165, h: 125, kind: 'pond' },
];

export function getTimeOfDayFromClock(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function isPointBlocked(x: number, y: number, padding = 18): boolean {
  if (x < 42 + padding || x > WORLD_WIDTH - 42 - padding) return true;
  if (y < 42 + padding || y > WORLD_HEIGHT - 42 - padding) return true;

  for (const wall of WALLS) {
    if (
      rectsOverlap(
        x - padding,
        y - padding,
        padding * 2,
        padding * 2,
        wall.x,
        wall.y,
        wall.w,
        wall.h
      )
    ) {
      return true;
    }
  }

  for (const obs of STATIC_OBSTACLES) {
    if (
      rectsOverlap(
        x - padding,
        y - padding,
        padding * 2,
        padding * 2,
        obs.x,
        obs.y,
        obs.w,
        obs.h
      )
    ) {
      return true;
    }
  }

  return false;
}

export function canPlaceFurniture(
  x: number,
  y: number,
  radius: number,
  existing: PlacedFurniture[],
  ignoreId?: string
): boolean {
  if (isPointBlocked(x, y, radius * 0.75)) {
    return false;
  }

  const doorwayZones = [
    { x: 830, y: 550, w: 60, h: 180 },
    { x: 430, y: 215, w: 60, h: 130 },
    { x: 205, y: 450, w: 130, h: 60 },
    { x: 555, y: 450, w: 170, h: 60 },
    // Keep garden plots and work gate clear
    { x: 915, y: 710, w: 350, h: 100 },
    { x: 1270, y: 465, w: 105, h: 110 },
  ];
  for (const d of doorwayZones) {
    if (rectsOverlap(x - radius, y - radius, radius * 2, radius * 2, d.x, d.y, d.w, d.h)) {
      return false;
    }
  }

  for (const item of existing) {
    if (ignoreId && item.id === ignoreId) continue;
    const itemRadius = FURNITURE_CATALOG[item.type].radius;
    const dist = Math.hypot(x - item.x, y - item.y);
    if (dist < radius + itemRadius + 14) {
      return false;
    }
  }

  return true;
}

const WALKABLE_GRID: boolean[][] = (() => {
  const grid: boolean[][] = [];
  for (let row = 0; row < NAV_ROWS; row++) {
    const rowArr: boolean[] = [];
    for (let col = 0; col < NAV_COLS; col++) {
      const cx = col * NAV_CELL_SIZE + NAV_CELL_SIZE / 2;
      const cy = row * NAV_CELL_SIZE + NAV_CELL_SIZE / 2;
      rowArr.push(!isPointBlocked(cx, cy, 16));
    }
    grid.push(rowArr);
  }
  return grid;
})();

function toCell(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(NAV_COLS - 1, Math.floor(x / NAV_CELL_SIZE))),
    row: Math.max(0, Math.min(NAV_ROWS - 1, Math.floor(y / NAV_CELL_SIZE))),
  };
}

function cellCenter(col: number, row: number): Vec2 {
  return {
    x: col * NAV_CELL_SIZE + NAV_CELL_SIZE / 2,
    y: row * NAV_CELL_SIZE + NAV_CELL_SIZE / 2,
  };
}

function findNearestWalkableCell(col: number, row: number): { col: number; row: number } {
  if (WALKABLE_GRID[row]?.[col]) return { col, row };

  const visited = new Set<string>();
  const queue: Array<{ col: number; row: number }> = [{ col, row }];
  visited.add(`${col},${row}`);

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (WALKABLE_GRID[cur.row]?.[cur.col]) {
      return cur;
    }
    for (const [dc, dr] of dirs) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nc < 0 || nc >= NAV_COLS || nr < 0 || nr >= NAV_ROWS) continue;
      const key = `${nc},${nr}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ col: nc, row: nr });
      }
    }
  }

  return { col: 10, row: 15 };
}

export function findPath(start: Vec2, goal: Vec2): Vec2[] {
  const rawStart = toCell(start.x, start.y);
  const rawGoal = toCell(goal.x, goal.y);

  const s = findNearestWalkableCell(rawStart.col, rawStart.row);
  const g = findNearestWalkableCell(rawGoal.col, rawGoal.row);

  if (s.col === g.col && s.row === g.row) {
    return [!isPointBlocked(goal.x, goal.y, 16) ? goal : cellCenter(g.col, g.row)];
  }

  const total = NAV_COLS * NAV_ROWS;
  const cameFrom = new Int32Array(total).fill(-1);
  const gScore = new Float32Array(total).fill(Infinity);
  const closed = new Uint8Array(total);

  const startIdx = s.row * NAV_COLS + s.col;
  const goalIdx = g.row * NAV_COLS + g.col;
  gScore[startIdx] = 0;

  const open: number[] = [startIdx];

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [-1, 1, 1.414],
    [1, -1, 1.414],
    [-1, -1, 1.414],
  ] as const;

  while (open.length > 0) {
    let bestPos = 0;
    let bestF = Infinity;
    for (let i = 0; i < open.length; i++) {
      const idx = open[i];
      const c = idx % NAV_COLS;
      const r = Math.floor(idx / NAV_COLS);
      const h = Math.hypot(g.col - c, g.row - r);
      const f = gScore[idx] + h;
      if (f < bestF) {
        bestF = f;
        bestPos = i;
      }
    }

    const current = open.splice(bestPos, 1)[0];
    if (current === goalIdx) {
      const cells: Vec2[] = [];
      let cur = goalIdx;
      while (cur !== -1 && cur !== startIdx) {
        const c = cur % NAV_COLS;
        const r = Math.floor(cur / NAV_COLS);
        cells.push(cellCenter(c, r));
        cur = cameFrom[cur];
      }
      cells.reverse();
      if (cells.length > 0 && !isPointBlocked(goal.x, goal.y, 16)) {
        cells[cells.length - 1] = goal;
      }
      return cells;
    }

    closed[current] = 1;
    const cc = current % NAV_COLS;
    const cr = Math.floor(current / NAV_COLS);

    for (const [dc, dr, cost] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= NAV_COLS || nr < 0 || nr >= NAV_ROWS) continue;
      if (!WALKABLE_GRID[nr][nc]) continue;
      if (dc !== 0 && dr !== 0) {
        if (!WALKABLE_GRID[cr][nc] || !WALKABLE_GRID[nr][cc]) continue;
      }

      const nIdx = nr * NAV_COLS + nc;
      if (closed[nIdx]) continue;

      const tentativeG = gScore[current] + cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        if (!open.includes(nIdx)) {
          open.push(nIdx);
        }
      }
    }
  }

  return [cellCenter(g.col, g.row)];
}

export const INDOOR_WINDOW_SPOTS: Vec2[] = [
  { x: 258, y: 120 },
  { x: 665, y: 120 },
  { x: 122, y: 738 },
];

export function getRandomWalkablePoint(): Vec2 {
  for (let i = 0; i < 40; i++) {
    const x = 95 + Math.random() * (WORLD_WIDTH - 190);
    const y = 95 + Math.random() * (WORLD_HEIGHT - 190);
    if (!isPointBlocked(x, y, 22)) {
      return { x, y };
    }
  }
  return { x: 400, y: 650 };
}

export function getRandomIndoorWalkablePoint(): Vec2 {
  for (let i = 0; i < 36; i++) {
    const x = 112 + Math.random() * 716;
    const y = 112 + Math.random() * 782;
    if (!isPointBlocked(x, y, 22)) {
      return { x, y };
    }
  }
  return { x: 380, y: 675 };
}

export function getZoneNameAt(x: number, y: number): string {
  for (let i = ZONES.length - 1; i >= 0; i--) {
    const z = ZONES[i];
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
      return z.label;
    }
  }
  return 'Quintal';
}

export function isPetSeeingFurniture(petPos: Vec2, furnPos: Vec2): boolean {
  const dist = Math.hypot(petPos.x - furnPos.x, petPos.y - furnPos.y);
  if (dist < 245) return true;
  const petZone = getZoneNameAt(petPos.x, petPos.y);
  const furnZone = getZoneNameAt(furnPos.x, furnPos.y);
  return petZone === furnZone && dist < 430;
}
