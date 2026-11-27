import type {
  FurnitureType,
  GardenPlot,
  PetAppearance,
  PetState,
  PlacedFurniture,
  SeedType,
  TimeOfDay,
  Vec2,
  WeatherType,
} from '../types/game';
import {
  DEFAULT_APPEARANCE,
  FURNITURE_CATALOG,
  STATIC_OBSTACLES,
  WALLS,
  WORK_GATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONES,
} from './mapData';

export interface FloatingNotice {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

export type ParticleKind = 'heart' | 'star' | 'water' | 'dust';

export interface HeartParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  timer: number;
  maxTimer: number;
  kind?: ParticleKind;
}

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  viewportWidth: number;
  viewportHeight: number;
  cameraX: number;
  cameraY: number;
  zoom: number;
  timeSec: number;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  pet: PetState;
  furniture: PlacedFurniture[];
  gardenPlots: GardenPlot[];
  activeSeedToPlant: SeedType | null;
  hoveredPlotId: string | null;
  hoveredGate: boolean;
  placingType: FurnitureType | null;
  hoverWorldPos: Vec2 | null;
  canPlaceAtHover: boolean;
  hoveredFurnitureId: string | null;
  selectedFurnitureId: string | null;
  notices: FloatingNotice[];
  hearts: HeartParticle[];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawFloors(ctx: CanvasRenderingContext2D, timeSec: number): void {
  ctx.fillStyle = '#96C177';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let i = 0; i < 95; i++) {
    const gx = ((i * 197 + 53) % (WORLD_WIDTH - 80)) + 40;
    const gy = ((i * 313 + 79) % (WORLD_HEIGHT - 80)) + 40;
    if (gx > 75 && gx < 865 && gy > 75 && gy < 925) continue;
    if (gx > 1045 && gx < 1240 && gy > 185 && gy < 340) continue;
    if (gx > 910 && gx < 1280 && gy > 700 && gy < 820) continue;

    ctx.fillStyle = i % 3 === 0 ? '#87B467' : '#A4CE86';
    ctx.beginPath();
    ctx.ellipse(gx, gy, 18 + (i % 12), 10 + (i % 7), (i % 5) * 0.4, 0, Math.PI * 2);
    ctx.fill();

    if (i % 4 === 0) {
      const sway = Math.sin(timeSec * 1.6 + i) * 1.5;
      ctx.strokeStyle = '#6D9A51';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx - 3, gy);
      ctx.lineTo(gx - 6 + sway, gy - 8);
      ctx.moveTo(gx + 2, gy);
      ctx.lineTo(gx + 4 + sway, gy - 9);
      ctx.stroke();
    }

    if (i % 9 === 0) {
      ctx.fillStyle = i % 18 === 0 ? '#FFF7D6' : '#FFE0E9';
      ctx.beginPath();
      ctx.arc(gx + 6, gy - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(gx + 6, gy - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Stepping stones to pond and work gate
  const stones = [
    { x: 905, y: 640, r: 22 },
    { x: 960, y: 635, r: 19 },
    { x: 1018, y: 615, r: 21 },
    { x: 1070, y: 575, r: 18 },
    { x: 1110, y: 525, r: 20 },
    { x: 1135, y: 465, r: 18 },
    { x: 1145, y: 400, r: 20 },
    { x: 1175, y: 525, r: 17 },
    { x: 1235, y: 522, r: 18 },
    { x: 1295, y: 520, r: 20 },
  ];
  for (const s of stones) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(s.x + 2, s.y + 4, s.r, s.r * 0.72, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#D7CFC2';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, s.r * 0.72, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#BFB5A5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Backyard wooden fence (with opening at Work Gate y=480..560)
  ctx.strokeStyle = '#8B6240';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(36, 36);
  ctx.lineTo(WORLD_WIDTH - 36, 36);
  ctx.lineTo(WORLD_WIDTH - 36, WORK_GATE.y - 44);
  ctx.moveTo(WORLD_WIDTH - 36, WORK_GATE.y + 44);
  ctx.lineTo(WORLD_WIDTH - 36, WORLD_HEIGHT - 36);
  ctx.lineTo(36, WORLD_HEIGHT - 36);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#A4754D';
  for (let x = 36; x <= WORLD_WIDTH - 36; x += 64) {
    drawRoundedRect(ctx, x - 6, 28, 12, 16, 3);
    ctx.fill();
    drawRoundedRect(ctx, x - 6, WORLD_HEIGHT - 44, 12, 16, 3);
    ctx.fill();
  }
  for (let y = 36; y <= WORLD_HEIGHT - 36; y += 64) {
    drawRoundedRect(ctx, 28, y - 6, 16, 12, 3);
    ctx.fill();
    if (Math.abs(y - WORK_GATE.y) > 48) {
      drawRoundedRect(ctx, WORLD_WIDTH - 44, y - 6, 16, 12, 3);
      ctx.fill();
    }
  }

  // House foundation shadow
  ctx.fillStyle = 'rgba(30, 25, 20, 0.16)';
  drawRoundedRect(ctx, 80, 82, 796, 858, 10);
  ctx.fill();

  for (const zone of ZONES) {
    if (zone.floor === 'grass') continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(zone.x, zone.y, zone.w, zone.h);
    ctx.clip();

    if (zone.floor === 'wood-cozy') {
      ctx.fillStyle = '#E5CCA8';
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      const plankH = 28;
      ctx.strokeStyle = 'rgba(148, 107, 62, 0.22)';
      ctx.lineWidth = 1.2;
      for (let py = zone.y; py < zone.y + zone.h; py += plankH) {
        ctx.beginPath();
        ctx.moveTo(zone.x, py);
        ctx.lineTo(zone.x + zone.w, py);
        ctx.stroke();
        const offset = ((py / plankH) % 2) * 55;
        for (let px = zone.x + offset; px < zone.x + zone.w; px += 110) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + plankH);
          ctx.stroke();
        }
      }
    } else if (zone.floor === 'wood-warm') {
      ctx.fillStyle = '#D9B689';
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      const plankH = 30;
      ctx.strokeStyle = 'rgba(122, 82, 42, 0.22)';
      ctx.lineWidth = 1.2;
      for (let py = zone.y; py < zone.y + zone.h; py += plankH) {
        ctx.beginPath();
        ctx.moveTo(zone.x, py);
        ctx.lineTo(zone.x + zone.w, py);
        ctx.stroke();
        const offset = ((py / plankH) % 2) * 65;
        for (let px = zone.x + offset; px < zone.x + zone.w; px += 130) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + plankH);
          ctx.stroke();
        }
      }
    } else if (zone.floor === 'tile-kitchen') {
      const tile = 40;
      for (let ty = zone.y; ty < zone.y + zone.h; ty += tile) {
        for (let tx = zone.x; tx < zone.x + zone.w; tx += tile) {
          const isAlt = ((tx / tile + ty / tile) | 0) % 2 === 0;
          ctx.fillStyle = isAlt ? '#F4EFE6' : '#E2E9DD';
          ctx.fillRect(tx, ty, tile, tile);
        }
      }
      ctx.strokeStyle = 'rgba(155, 148, 136, 0.28)';
      ctx.lineWidth = 1;
      for (let ty = zone.y; ty <= zone.y + zone.h; ty += tile) {
        ctx.beginPath();
        ctx.moveTo(zone.x, ty);
        ctx.lineTo(zone.x + zone.w, ty);
        ctx.stroke();
      }
      for (let tx = zone.x; tx <= zone.x + zone.w; tx += tile) {
        ctx.beginPath();
        ctx.moveTo(tx, zone.y);
        ctx.lineTo(tx, zone.y + zone.h);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Rugs
  ctx.fillStyle = '#E8D5DE';
  ctx.beginPath();
  ctx.ellipse(265, 305, 86, 64, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D5B8C6';
  ctx.lineWidth = 4;
  ctx.stroke();

  drawRoundedRect(ctx, 215, 605, 290, 210, 18);
  ctx.fillStyle = '#EAE0D0';
  ctx.fill();
  ctx.strokeStyle = '#C99E76';
  ctx.lineWidth = 5;
  ctx.stroke();
  drawRoundedRect(ctx, 232, 622, 256, 176, 12);
  ctx.strokeStyle = '#D9B99B';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, 815, 605, 36, 70, 6);
  ctx.fillStyle = '#A87D56';
  ctx.fill();
}

function drawGardenPlots(
  ctx: CanvasRenderingContext2D,
  plots: GardenPlot[],
  activeSeedToPlant: SeedType | null,
  hoveredPlotId: string | null,
  timeSec: number
): void {
  for (const plot of plots) {
    const w = 84;
    const h = 60;
    const x = plot.x - w / 2;
    const y = plot.y - h / 2;
    const isHovered = hoveredPlotId === plot.id;

    // Planter box border
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    drawRoundedRect(ctx, x + 2, y + 4, w, h, 10);
    ctx.fill();

    drawRoundedRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = '#8B5E3C';
    ctx.fill();

    if (isHovered || (activeSeedToPlant && !plot.seed)) {
      ctx.strokeStyle = activeSeedToPlant && !plot.seed ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Soil interior
    drawRoundedRect(ctx, x + 6, y + 6, w - 12, h - 12, 6);
    ctx.fillStyle = plot.watered ? '#5C3D28' : '#7C5438';
    ctx.fill();

    // Soil furrows
    ctx.strokeStyle = plot.watered ? '#492E1C' : '#68442C';
    ctx.lineWidth = 2;
    for (let r = -12; r <= 12; r += 12) {
      ctx.beginPath();
      ctx.moveTo(plot.x - 26, plot.y + r);
      ctx.lineTo(plot.x + 26, plot.y + r);
      ctx.stroke();
    }

    // Plant stages with gentle wind sway
    if (plot.seed && plot.stage > 0) {
      const positions = [-20, 0, 20];

      for (const px of positions) {
        const cx = plot.x + px;
        const cy = plot.y + 4;
        const sway = Math.sin(timeSec * 2.3 + plot.x * 0.02 + px * 0.08) * 2.1;

        if (plot.stage === 1) {
          ctx.strokeStyle = '#65A30D';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + sway * 0.55, cy - 10);
          ctx.stroke();
          ctx.fillStyle = '#84CC16';
          ctx.beginPath();
          ctx.ellipse(cx + 3 + sway * 0.55, cy - 10, 4, 2.5, -0.4 + sway * 0.04, 0, Math.PI * 2);
          ctx.fill();
        } else if (plot.stage === 2) {
          ctx.strokeStyle = '#4D7C0F';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + sway * 0.8, cy - 17);
          ctx.stroke();
          ctx.fillStyle = '#65A30D';
          ctx.beginPath();
          ctx.ellipse(cx - 5 + sway * 0.5, cy - 12, 6, 3.5, -0.5 + sway * 0.04, 0, Math.PI * 2);
          ctx.ellipse(cx + 5 + sway * 0.65, cy - 14, 6, 3.5, 0.5 + sway * 0.04, 0, Math.PI * 2);
          ctx.fill();
        } else if (plot.stage === 3) {
          if (plot.seed === 'carrot') {
            // Plump carrot top peeking out + swaying feathery greens
            ctx.strokeStyle = '#15803D';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx - 6 + sway, cy - 20);
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx + 5 + sway, cy - 22);
            ctx.stroke();

            ctx.fillStyle = '#F97316';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 1, 6.5, 8, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (plot.seed === 'tomato') {
            ctx.fillStyle = '#166534';
            ctx.beginPath();
            ctx.arc(cx + sway * 0.75, cy - 12, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(cx - 4 + sway * 0.75, cy - 10, 4.5, 0, Math.PI * 2);
            ctx.arc(cx + 5 + sway * 0.75, cy - 14, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (plot.seed === 'sunflower') {
            ctx.strokeStyle = '#15803D';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy + 2);
            ctx.lineTo(cx + sway, cy - 18);
            ctx.stroke();

            ctx.fillStyle = '#FACC15';
            for (let p = 0; p < 8; p++) {
              const ang = (p * Math.PI * 2) / 8 + sway * 0.03;
              ctx.beginPath();
              ctx.ellipse(
                cx + sway + Math.cos(ang) * 7,
                cy - 20 + Math.sin(ang) * 7,
                4,
                2.5,
                ang,
                0,
                Math.PI * 2
              );
              ctx.fill();
            }
            ctx.fillStyle = '#78350F';
            ctx.beginPath();
            ctx.arc(cx + sway, cy - 20, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    if (isHovered || (plot.seed && !plot.watered && plot.stage < 3)) {
      const label = !plot.seed
        ? activeSeedToPlant
          ? 'Plantar aqui'
          : 'Canteiro vazio'
        : plot.stage === 3
          ? 'Pronto! (clique)'
          : !plot.watered
            ? 'Regar (clique)'
            : 'Crescendo...';

      ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
      const lw = ctx.measureText(label).width + 12;
      drawRoundedRect(ctx, plot.x - lw / 2, y - 24, lw, 18, 5);
      ctx.fillStyle = plot.stage === 3 ? '#047857' : !plot.watered && plot.seed ? '#0284C7' : '#2B2520';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, plot.x, y - 15);
    }
  }
}

function drawWorkGate(
  ctx: CanvasRenderingContext2D,
  pet: PetState,
  hoveredGate: boolean
): void {
  const gx = WORK_GATE.x;
  const gy = WORK_GATE.y;

  // Gate posts
  ctx.fillStyle = '#7C4D2B';
  drawRoundedRect(ctx, gx - 10, gy - 48, 16, 16, 4);
  ctx.fill();
  drawRoundedRect(ctx, gx - 10, gy + 32, 16, 16, 4);
  ctx.fill();

  // Swinging gate bar
  ctx.strokeStyle = hoveredGate ? '#F59E0B' : '#B47E52';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gx - 2, gy - 36);
  ctx.lineTo(gx - 2, gy + 36);
  ctx.stroke();

  // Wooden signpost
  drawRoundedRect(ctx, gx - 58, gy - 70, 68, 22, 6);
  ctx.fillStyle = hoveredGate ? '#D97706' : '#2B2520';
  ctx.fill();
  ctx.fillStyle = '#FAF7F2';
  ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Trabalho', gx - 24, gy - 59);

  if (pet.state === 'WORKING') {
    const secs = Math.max(1, Math.ceil(pet.stateTimer));
    const badge = `Na cidade · ${secs}s`;
    const bw = ctx.measureText(badge).width + 16;
    drawRoundedRect(ctx, gx - bw - 14, gy - 12, bw, 24, 8);
    ctx.fillStyle = '#047857';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(badge, gx - bw / 2 - 14, gy);
  }
}

function drawStaticProps(ctx: CanvasRenderingContext2D, timeSec: number): void {
  for (const obs of STATIC_OBSTACLES) {
    if (obs.kind === 'pond') {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      ctx.fillStyle = '#B8B0A2';
      ctx.beginPath();
      ctx.ellipse(cx, cy, obs.w / 2 + 8, obs.h / 2 + 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6FAED9';
      ctx.beginPath();
      ctx.ellipse(cx, cy, obs.w / 2, obs.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      const rippleR = 16 + ((timeSec * 14) % 34);
      const rippleAlpha = Math.max(0, 1 - rippleR / 50) * 0.45;
      ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx - 12, cy + 4, rippleR, rippleR * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#5FA35D';
      ctx.beginPath();
      ctx.arc(cx + 28, cy - 12, 13, 0.25, Math.PI * 2 - 0.25);
      ctx.lineTo(cx + 28, cy - 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FAD2E1';
      ctx.beginPath();
      ctx.arc(cx + 28, cy - 14, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.kind === 'counter') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      drawRoundedRect(ctx, obs.x + 3, obs.y + 5, obs.w, obs.h, 8);
      ctx.fill();
      drawRoundedRect(ctx, obs.x, obs.y, obs.w, obs.h, 8);
      ctx.fillStyle = '#F7F4EE';
      ctx.fill();
      ctx.strokeStyle = '#CFC7B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      drawRoundedRect(ctx, obs.x + 28, obs.y + 10, 52, 32, 6);
      ctx.fillStyle = '#D5DEE2';
      ctx.fill();
      ctx.strokeStyle = '#9EB0B8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawRoundedRect(ctx, obs.x + 115, obs.y + 12, 38, 28, 4);
      ctx.fillStyle = '#C6925C';
      ctx.fill();

      ctx.fillStyle = '#E07A5F';
      ctx.beginPath();
      ctx.arc(obs.x + 195, obs.y + 26, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3D342E';
      ctx.beginPath();
      ctx.arc(obs.x + 195, obs.y + 26, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.kind === 'sofa') {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      drawRoundedRect(ctx, obs.x + 4, obs.y + 6, obs.w, obs.h, 14);
      ctx.fill();
      drawRoundedRect(ctx, obs.x, obs.y, obs.w, obs.h, 14);
      ctx.fillStyle = '#6D8B74';
      ctx.fill();
      ctx.strokeStyle = '#536D59';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawRoundedRect(ctx, obs.x + 6, obs.y + 10, 18, obs.h - 20, 8);
      ctx.fillStyle = '#5B7662';
      ctx.fill();
      drawRoundedRect(ctx, obs.x + 26, obs.y + 14, 34, 66, 8);
      ctx.fillStyle = '#7E9E85';
      ctx.fill();
      drawRoundedRect(ctx, obs.x + 26, obs.y + 88, 34, 66, 8);
      ctx.fill();
    } else if (obs.kind === 'table') {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      drawRoundedRect(ctx, obs.x + 4, obs.y + 6, obs.w, obs.h, 10);
      ctx.fill();
      drawRoundedRect(ctx, obs.x, obs.y, obs.w, obs.h, 10);
      ctx.fillStyle = '#9C6B43';
      ctx.fill();
      ctx.strokeStyle = '#7A502E';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawRoundedRect(ctx, obs.x + 12, obs.y + 14, 24, 18, 2);
      ctx.fillStyle = '#F2E9E4';
      ctx.fill();
      ctx.fillStyle = '#E09F3E';
      ctx.beginPath();
      ctx.arc(obs.x + 34, obs.y + 54, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.kind === 'bookshelf') {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      drawRoundedRect(ctx, obs.x + 3, obs.y + 5, obs.w, obs.h, 6);
      ctx.fill();
      drawRoundedRect(ctx, obs.x, obs.y, obs.w, obs.h, 6);
      ctx.fillStyle = '#7D5434';
      ctx.fill();
      ctx.strokeStyle = '#5E3D23';
      ctx.lineWidth = 2;
      ctx.stroke();
      const bookColors = ['#E07A5F', '#F2CC8F', '#81B29A', '#3D405B', '#E5989B', '#98C1D9'];
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = bookColors[i % bookColors.length];
        drawRoundedRect(ctx, obs.x + 12 + i * 13, obs.y + 8, 10, 28, 2);
        ctx.fill();
      }
    }
  }

  const plants = [
    { x: 118, y: 520 },
    { x: 816, y: 865 },
    { x: 920, y: 145 },
    { x: 1290, y: 865 },
  ];
  for (const p of plants) {
    const isOutdoor = p.x > 870;
    const swayRot = Math.sin(timeSec * (isOutdoor ? 2.1 : 1.1) + p.x * 0.03) * (isOutdoor ? 0.085 : 0.025);

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 4, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C97B57';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(swayRot);
    ctx.fillStyle = '#4F8A54';
    for (let a = 0; a < 5; a++) {
      const ang = (a * Math.PI * 2) / 5 + 0.3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * 9, Math.sin(ang) * 9, 9, 5, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#6DB36F';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawWalls(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(35, 25, 15, 0.16)';
  for (const w of WALLS) {
    ctx.fillRect(w.x + 4, w.y + 6, w.w, w.h);
  }
  for (const w of WALLS) {
    ctx.fillStyle = '#EFE8DC';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#B9AD99';
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }
  const windows = [
    { x: 210, y: 74, w: 96, h: 16 },
    { x: 610, y: 74, w: 110, h: 16 },
    { x: 74, y: 690, w: 16, h: 96 },
  ];
  for (const win of windows) {
    ctx.fillStyle = '#B8E1F4';
    ctx.fillRect(win.x, win.y, win.w, win.h);
    ctx.strokeStyle = '#7AA6BC';
    ctx.lineWidth = 2;
    ctx.strokeRect(win.x, win.y, win.w, win.h);
  }
}

function drawFurnitureItem(
  ctx: CanvasRenderingContext2D,
  item: PlacedFurniture,
  timeSec: number,
  isHovered: boolean,
  isSelected: boolean,
  petUsingThis: boolean,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(item.x, item.y);

  if (isHovered || isSelected) {
    const r = FURNITURE_CATALOG[item.type].radius + 8;
    ctx.strokeStyle = isSelected ? '#D97706' : 'rgba(217, 119, 6, 0.65)';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.setLineDash(isSelected ? [] : [5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (item.type === 'fridge') {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    drawRoundedRect(ctx, -20, -22, 42, 48, 9);
    ctx.fill();
    drawRoundedRect(ctx, -22, -26, 42, 48, 9);
    ctx.fillStyle = '#D9EDE2';
    ctx.fill();
    ctx.strokeStyle = '#7CA690';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20, -6);
    ctx.lineTo(18, -6);
    ctx.stroke();
    ctx.fillStyle = '#5F8471';
    drawRoundedRect(ctx, 11, -18, 4, 9, 2);
    ctx.fill();
    drawRoundedRect(ctx, 11, -1, 4, 14, 2);
    ctx.fill();

    ctx.fillStyle = '#E07A5F';
    ctx.beginPath();
    ctx.arc(-20, 22, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF8F0';
    ctx.beginPath();
    ctx.arc(-20, 22, 8.5, 0, Math.PI * 2);
    ctx.fill();

    if (item.foodStock > 0) {
      ctx.fillStyle = '#B8743B';
      const pieces = Math.min(item.foodStock + 2, 6);
      for (let i = 0; i < pieces; i++) {
        const ang = (i * Math.PI * 2) / pieces;
        const dist = i === 0 ? 0 : 4;
        ctx.beginPath();
        ctx.arc(-20 + Math.cos(ang) * dist, 22 + Math.sin(ang) * dist, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (isHovered || item.foodStock === 0) {
      const label = item.foodStock === 0 ? 'Vazia' : `${item.foodStock}/${item.maxFoodStock}`;
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      const w = ctx.measureText(label).width + 12;
      drawRoundedRect(ctx, -w / 2, -46, w, 18, 5);
      ctx.fillStyle = item.foodStock === 0 ? '#DC2626' : '#2B2520';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, -37);
    }
  } else if (item.type === 'mat') {
    // Simple starter sleeping mat
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    drawRoundedRect(ctx, -28, -19, 58, 40, 10);
    ctx.fill();
    drawRoundedRect(ctx, -30, -21, 58, 40, 10);
    ctx.fillStyle = '#CBD5E1';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawRoundedRect(ctx, -23, -14, 44, 26, 6);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
  } else if (item.type === 'bed') {
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.ellipse(2, 5, 36, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#D68A7C';
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B4685B';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFF3E4';
    ctx.beginPath();
    ctx.ellipse(0, 1, 26, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F2C57C';
    ctx.beginPath();
    ctx.ellipse(10, 4, 13, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'easel') {
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.ellipse(2, 10, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8B5E3C';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-16, 18);
    ctx.moveTo(0, -26);
    ctx.lineTo(16, 18);
    ctx.moveTo(0, -26);
    ctx.lineTo(0, 22);
    ctx.stroke();

    drawRoundedRect(ctx, -18, -24, 36, 30, 3);
    ctx.fillStyle = '#FFFDF9';
    ctx.fill();
    ctx.strokeStyle = '#C7B8A1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(-6, -13, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(-12, -5, 24, 6);
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(0, -8);
    ctx.lineTo(10, 2);
    ctx.closePath();
    ctx.fill();

    if (petUsingThis) {
      for (let s = 0; s < 3; s++) {
        const ang = timeSec * 3 + (s * Math.PI * 2) / 3;
        const sx = Math.cos(ang) * 26;
        const sy = -10 + Math.sin(ang * 1.3) * 14;
        ctx.fillStyle = ['#F59E0B', '#EC4899', '#38BDF8'][s];
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#E5C69B';
    ctx.beginPath();
    ctx.ellipse(20, 12, 9, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'computer') {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    drawRoundedRect(ctx, -26, -18, 54, 40, 6);
    ctx.fill();
    drawRoundedRect(ctx, -28, -22, 56, 38, 6);
    ctx.fillStyle = '#B88456';
    ctx.fill();
    ctx.strokeStyle = '#8C5E37';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawRoundedRect(ctx, -18, -20, 36, 22, 4);
    ctx.fillStyle = '#334155';
    ctx.fill();
    drawRoundedRect(ctx, -15, -17, 30, 16, 2);
    ctx.fillStyle = petUsingThis ? '#60A5FA' : '#93C5FD';
    ctx.fill();
    if (petUsingThis) {
      const barW = 10 + Math.sin(timeSec * 6) * 6;
      ctx.fillStyle = '#EFF6FF';
      ctx.fillRect(-12, -14, barW, 3);
      ctx.fillRect(-12, -8, 18, 3);
    }
    drawRoundedRect(ctx, -12, 6, 24, 7, 2);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.ellipse(18, 10, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'diary') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    drawRoundedRect(ctx, -20, -16, 42, 34, 7);
    ctx.fill();
    drawRoundedRect(ctx, -22, -20, 42, 34, 7);
    ctx.fillStyle = '#A97142';
    ctx.fill();
    ctx.strokeStyle = '#7D4E28';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawRoundedRect(ctx, -14, -14, 24, 22, 3);
    ctx.fillStyle = '#7C2D49';
    ctx.fill();
    ctx.strokeStyle = '#581C32';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    drawRoundedRect(ctx, 7, -6, 5, 6, 1.5);
    ctx.fillStyle = '#FBBF24';
    ctx.fill();
    ctx.strokeStyle = '#FFFDF9';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(19, -10);
    ctx.stroke();

    if (petUsingThis) {
      const bob = Math.sin(timeSec * 8) * 3;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(0, -24 + bob, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isHovered) {
      const label = 'Diário (clique)';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      const w = ctx.measureText(label).width + 12;
      drawRoundedRect(ctx, -w / 2, -40, w, 18, 5);
      ctx.fillStyle = '#2B2520';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, -31);
    }
  } else if (item.type === 'ball') {
    const hop = petUsingThis ? -Math.abs(Math.sin(timeSec * 8)) * 7 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(2, 6, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, hop);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Classic pentagon patches
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.arc(-8, -6, 3, 0, Math.PI * 2);
    ctx.arc(8, -5, 3, 0, Math.PI * 2);
    ctx.arc(-6, 8, 3, 0, Math.PI * 2);
    ctx.arc(7, 7, 3, 0, Math.PI * 2);
    ctx.fill();

    if (isHovered) {
      const label = 'Pênaltis (clique)';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      const w = ctx.measureText(label).width + 12;
      drawRoundedRect(ctx, -w / 2, -34, w, 18, 5);
      ctx.fillStyle = '#047857';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, -25);
    }
  }

  ctx.restore();
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface DrawPetCharacterOptions {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  appearance: PetAppearance;
  timeSec: number;
  scale?: number;
  walkCycle?: number;
  isMoving?: boolean;
  isSleeping?: boolean;
  isEating?: boolean;
  isPainting?: boolean;
  isCalling?: boolean;
  isHappyEyes?: boolean;
  isComplaining?: boolean;
  isGrumpy?: boolean;
  isBlinking?: boolean;
  isLookingAtScreen?: boolean;
  lookX?: number;
  lookY?: number;
}

export function drawPetCharacter(opts: DrawPetCharacterOptions): void {
  const {
    ctx,
    x,
    y,
    appearance,
    timeSec,
    scale = 1,
    walkCycle = 0,
    isMoving = false,
    isSleeping = false,
    isEating = false,
    isPainting = false,
    isCalling = false,
    isHappyEyes = false,
    isComplaining = false,
    isGrumpy = false,
    isBlinking = false,
    isLookingAtScreen = false,
    lookX = 0,
    lookY = 0,
  } = opts;

  const app = appearance ?? DEFAULT_APPEARANCE;

  const bounceY = isMoving
    ? -Math.abs(Math.sin(walkCycle * 2)) * 5.5
    : isSleeping
      ? Math.sin(timeSec * 2) * 1.2
      : isCalling
        ? -Math.abs(Math.sin(timeSec * 6)) * 6
        : Math.sin(timeSec * 2.8) * 1.5;

  const squashX = isMoving
    ? 1 + Math.cos(walkCycle * 2) * 0.05
    : isSleeping
      ? 1.08 + Math.sin(timeSec * 2) * 0.025
      : 1;
  const squashY = isMoving
    ? 1 - Math.cos(walkCycle * 2) * 0.05
    : isSleeping
      ? 0.88 - Math.sin(timeSec * 2) * 0.02
      : 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Dynamic oval ground shadow responding to pet bounce/jump height & movement
  const airLift = Math.max(0, -bounceY);
  const shadowScale = Math.max(0.66, 1 - airLift * 0.032);
  const shadowAlpha = Math.max(0.11, 0.22 - airLift * 0.011);
  const shadowOffsetX = isMoving ? -lookX * 1.6 : 0;
  ctx.fillStyle = `rgba(25, 18, 12, ${shadowAlpha.toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(shadowOffsetX, 17.5, 20 * squashX * shadowScale, 8.8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, bounceY);
  ctx.scale(squashX, squashY);

  // Tail (unless boxy robot)
  if (app.bodyShape !== 'boxy') {
    const tailWag = Math.sin(timeSec * (isCalling || isEating ? 12 : 4)) * 0.35;
    ctx.save();
    ctx.translate(-lookX * 14, 6);
    ctx.rotate(tailWag);
    ctx.fillStyle = app.secondaryColor;
    ctx.beginPath();
    ctx.ellipse(-6, 0, 9, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3E2A1E';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Ears / Antennas / Horns
  const earBounce = isMoving ? Math.sin(walkCycle * 2 + 0.5) * 2.5 : 0;
  if (app.earStyle === 'floppy') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 14, -14 + earBounce);
      ctx.rotate(side * 0.34);
      ctx.fillStyle = app.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3E2A1E';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }
  } else if (app.earStyle === 'cat') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 12, -16 + earBounce);
      ctx.beginPath();
      ctx.moveTo(-6, 5);
      ctx.lineTo(side * 2, -11);
      ctx.lineTo(7, 4);
      ctx.closePath();
      ctx.fillStyle = app.primaryColor;
      ctx.fill();
      ctx.strokeStyle = '#3E2A1E';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = app.accentColor;
      ctx.beginPath();
      ctx.moveTo(-3, 3);
      ctx.lineTo(side * 1.5, -6);
      ctx.lineTo(4, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (app.earStyle === 'antenna') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 7, -18 + earBounce);
      ctx.strokeStyle = '#3E2A1E';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(side * 4, -11);
      ctx.stroke();
      ctx.fillStyle = app.accentColor;
      ctx.beginPath();
      ctx.arc(side * 4, -12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (app.earStyle === 'horns') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 11, -16);
      ctx.fillStyle = app.accentColor;
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.quadraticCurveTo(side * 4, -10, side * 7, -11);
      ctx.quadraticCurveTo(side * 5, -2, 4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3E2A1E';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Body Shape
  let bodyW = 22;
  let bodyH = 19;
  if (app.bodyShape === 'chubby') {
    bodyW = 25;
    bodyH = 20;
  } else if (app.bodyShape === 'tall') {
    bodyW = 19;
    bodyH = 22;
  }

  ctx.fillStyle = app.primaryColor;
  ctx.strokeStyle = '#3E2A1E';
  ctx.lineWidth = 2.4;
  if (app.bodyShape === 'boxy') {
    drawRoundedRect(ctx, -21, -19, 42, 37, 9);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Belly / chest patch
  ctx.fillStyle = app.secondaryColor;
  if (app.bodyShape === 'boxy') {
    drawRoundedRect(ctx, -12, 3, 24, 12, 4);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 7, 13, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Paws / Feet
  const pawOffset = isMoving ? Math.sin(walkCycle * 2) * 4 : 0;
  ctx.fillStyle = app.secondaryColor;
  ctx.strokeStyle = '#3E2A1E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-9, 16 + pawOffset, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9, 16 - pawOffset, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Accessory: Scarf (under face)
  if (app.accessory === 'scarf') {
    drawRoundedRect(ctx, -16, 6, 32, 7, 3.5);
    ctx.fillStyle = app.accentColor;
    ctx.fill();
    ctx.strokeStyle = '#3E2A1E';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    drawRoundedRect(ctx, 4, 10, 7, 10, 2.5);
    ctx.fill();
    ctx.stroke();
  }

  // Face direction offset
  const faceX = isLookingAtScreen ? 0 : lookX * 4.5;
  const faceY = isLookingAtScreen ? 1.5 : lookY * 3;

  // Cheeks
  ctx.fillStyle = isComplaining ? 'rgba(239, 68, 68, 0.32)' : 'rgba(244, 114, 182, 0.32)';
  ctx.beginPath();
  ctx.arc(faceX - 11, faceY + 2, 3.8, 0, Math.PI * 2);
  ctx.arc(faceX + 11, faceY + 2, 3.8, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const leftEyeX = faceX - 7;
  const rightEyeX = faceX + 7;
  const eyeY = faceY - 3;

  if (app.eyeStyle === 'visor' && !isSleeping) {
    drawRoundedRect(ctx, faceX - 14, eyeY - 5, 28, 10, 4);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = isGrumpy ? '#EF4444' : '#38BDF8';
    const vx = isLookingAtScreen ? 0 : lookX * 2.2;
    ctx.beginPath();
    ctx.arc(leftEyeX + vx, eyeY, 2.6, 0, Math.PI * 2);
    ctx.arc(rightEyeX + vx, eyeY, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (isSleeping) {
    ctx.strokeStyle = '#2B1B12';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY + 1, 3.5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY + 1, 3.5, 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else if (isEating || isCalling || isHappyEyes) {
    ctx.strokeStyle = '#2B1B12';
    ctx.lineWidth = 2.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY + 2, 3.8, Math.PI + 0.3, -0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY + 2, 3.8, Math.PI + 0.3, -0.3);
    ctx.stroke();
  } else if (isBlinking) {
    ctx.strokeStyle = '#2B1B12';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 3.5, eyeY);
    ctx.lineTo(leftEyeX + 3.5, eyeY);
    ctx.moveTo(rightEyeX - 3.5, eyeY);
    ctx.lineTo(rightEyeX + 3.5, eyeY);
    ctx.stroke();
  } else {
    const pupilShiftX = isLookingAtScreen ? 0 : lookX * 1.4;
    const pupilShiftY = isLookingAtScreen ? 0.5 : lookY * 1.2;

    for (const ex of [leftEyeX, rightEyeX]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 4.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E140E';
      ctx.beginPath();
      ctx.arc(ex + pupilShiftX, eyeY + pupilShiftY, 3.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex + pupilShiftX - 1, eyeY + pupilShiftY - 1, 1.2, 0, Math.PI * 2);
      ctx.fill();

      if (app.eyeStyle === 'sparkle' || isPainting) {
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(ex + pupilShiftX + 1.2, eyeY + pupilShiftY + 1.1, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (app.eyeStyle === 'sleepy') {
        ctx.fillStyle = app.primaryColor;
        ctx.fillRect(ex - 4.5, eyeY - 4.8, 9, 3.4);
      }
    }

    if (isGrumpy) {
      ctx.strokeStyle = '#2B1B12';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 4, eyeY - 6.5);
      ctx.lineTo(leftEyeX + 3, eyeY - 4);
      ctx.moveTo(rightEyeX + 4, eyeY - 6.5);
      ctx.lineTo(rightEyeX - 3, eyeY - 4);
      ctx.stroke();
    }
  }

  // Glasses accessory
  if (app.accessory === 'glasses') {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, 5.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY, 5.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(leftEyeX + 5.2, eyeY);
    ctx.lineTo(rightEyeX - 5.2, eyeY);
    ctx.stroke();
  }

  // Mouth
  ctx.strokeStyle = '#2B1B12';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const mouthY = faceY + 4;

  if (isGrumpy) {
    ctx.beginPath();
    ctx.arc(faceX, mouthY + 3.5, 3.8, Math.PI + 0.35, -0.35);
    ctx.stroke();
  } else if (isComplaining) {
    ctx.beginPath();
    ctx.moveTo(faceX - 4.5, mouthY + 2);
    ctx.quadraticCurveTo(faceX - 2, mouthY - 1.5, faceX, mouthY + 1);
    ctx.quadraticCurveTo(faceX + 2, mouthY + 3.5, faceX + 4.5, mouthY + 0.5);
    ctx.stroke();
  } else if (isSleeping) {
    ctx.fillStyle = '#E07A5F';
    ctx.beginPath();
    ctx.arc(faceX, mouthY + 1, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (isEating) {
    const chewOpen = Math.abs(Math.sin(timeSec * 14)) * 2.5 + 1.5;
    ctx.fillStyle = '#E07A5F';
    ctx.beginPath();
    ctx.ellipse(faceX, mouthY + 1, 3.2, chewOpen, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (isPainting) {
    ctx.beginPath();
    ctx.arc(faceX, mouthY + 1, 2.2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(faceX - 2.3, mouthY, 2.3, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(faceX + 2.3, mouthY, 2.3, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  // Head accessories: Crown, Bow, Bolt
  if (app.accessory === 'crown') {
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#854D0E';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -17);
    ctx.lineTo(-9, -26);
    ctx.lineTo(-3, -21);
    ctx.lineTo(0, -28);
    ctx.lineTo(3, -21);
    ctx.lineTo(9, -26);
    ctx.lineTo(8, -17);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (app.accessory === 'bow') {
    ctx.fillStyle = app.accentColor;
    ctx.strokeStyle = '#3E2A1E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(8, -17, 5, 3.2, -0.3, 0, Math.PI * 2);
    ctx.ellipse(15, -15, 5, 3.2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (app.accessory === 'bolt') {
    ctx.fillStyle = '#94A3B8';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, -24, -4, 4, 8, 1);
    ctx.fill();
    ctx.stroke();
    drawRoundedRect(ctx, 20, -4, 4, 8, 1);
    ctx.fill();
    ctx.stroke();
  }

  if (isPainting) {
    const brushAngle = Math.sin(timeSec * 8) * 0.35;
    ctx.save();
    ctx.translate(18, 4);
    ctx.rotate(brushAngle);
    ctx.strokeStyle = '#8B5E3C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -10);
    ctx.stroke();
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.arc(0, -12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawPet(ctx: CanvasRenderingContext2D, pet: PetState, timeSec: number): void {
  if (pet.state === 'WORKING') {
    return;
  }

  const isMoving = Math.hypot(pet.vx, pet.vy) > 4;
  const isSleeping = pet.state === 'SLEEPING';
  const isEating = pet.state === 'EATING';
  const isPainting = pet.state === 'PAINTING' || pet.state === 'INSPIRING';
  const isCalling = pet.state === 'CALLING_PLAYER';
  const isHappyEyes = (pet.happyEyesTimer ?? 0) > 0;
  const isComplaining = pet.state === 'HUNGRY_COMPLAINT' || pet.hunger < 35;

  drawPetCharacter({
    ctx,
    x: pet.x,
    y: pet.y,
    appearance: pet.appearance,
    timeSec,
    walkCycle: pet.walkCycle,
    isMoving,
    isSleeping,
    isEating,
    isPainting,
    isCalling,
    isHappyEyes,
    isComplaining,
    isGrumpy: pet.grumpyTimer > 0 || pet.affinity < 40,
    isBlinking: pet.isBlinking,
    isLookingAtScreen: pet.isLookingAtScreen,
    lookX: pet.lookX,
    lookY: pet.lookY,
  });

  if (isSleeping) {
    ctx.save();
    ctx.font = '700 13px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const progress = (timeSec * 0.55 + i * 0.33) % 1;
      const zx = pet.x + 16 + progress * 14;
      const zy = pet.y - 24 - progress * 28;
      ctx.fillStyle = `rgba(99, 102, 241, ${(1 - progress).toFixed(2)})`;
      ctx.fillText('Z', zx, zy);
    }
    ctx.restore();
  }

  // Speech / Thought / Icon Bubble above head
  if (pet.bubbleText) {
    ctx.save();
    if (pet.bubbleKind === 'icon') {
      const boxW = 48;
      const boxH = 38;
      const boxX = pet.x - boxW / 2;
      const boxY = Math.max(12, pet.y - 44 - boxH);

      ctx.fillStyle = 'rgba(25, 20, 15, 0.16)';
      drawRoundedRect(ctx, boxX + 2, boxY + 4, boxW, boxH, 12);
      ctx.fill();

      drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 12);
      ctx.fillStyle = '#FFFDF9';
      ctx.fill();
      ctx.strokeStyle = pet.activeComputerActivity === 'sus' ? '#D97706' : '#3B82F6';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pet.bubbleText, pet.x, boxY + boxH / 2 + 1);
      ctx.restore();
      return;
    }

    ctx.font = '600 12.5px "Plus Jakarta Sans", sans-serif';
    const lines = wrapTextLines(ctx, pet.bubbleText, 175);
    let maxLineW = 0;
    for (const line of lines) {
      maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
    }
    const padX = 12;
    const padY = 8;
    const lineHeight = 16;
    const boxW = Math.max(54, maxLineW + padX * 2);
    const boxH = lines.length * lineHeight + padY * 2 - 2;
    const boxX = Math.max(12, Math.min(WORLD_WIDTH - boxW - 12, pet.x - boxW / 2));
    const boxY = Math.max(12, pet.y - 44 - boxH);

    ctx.fillStyle = 'rgba(25, 20, 15, 0.14)';
    drawRoundedRect(ctx, boxX + 2, boxY + 4, boxW, boxH, 12);
    ctx.fill();

    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 12);
    ctx.fillStyle = '#FFFDF9';
    ctx.fill();
    ctx.strokeStyle = pet.state === 'HUNGRY_COMPLAINT' ? '#EF4444' : '#D6CBB8';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (pet.bubbleKind === 'thought') {
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = '#D6CBB8';
      ctx.beginPath();
      ctx.arc(pet.x, boxY + boxH + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pet.x - 3, boxY + boxH + 13, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFDF9';
      ctx.beginPath();
      ctx.moveTo(pet.x - 6, boxY + boxH - 1);
      ctx.lineTo(pet.x, boxY + boxH + 8);
      ctx.lineTo(pet.x + 6, boxY + boxH - 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pet.state === 'HUNGRY_COMPLAINT' ? '#EF4444' : '#D6CBB8';
      ctx.beginPath();
      ctx.moveTo(pet.x - 6, boxY + boxH);
      ctx.lineTo(pet.x, boxY + boxH + 8);
      ctx.lineTo(pet.x + 6, boxY + boxH);
      ctx.stroke();
    }

    ctx.fillStyle = '#2B2520';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = boxX + boxW / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], centerX, boxY + padY + lineHeight * (i + 0.45));
    }
    ctx.restore();
  }
}

function drawLightingOverlay(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  weather: WeatherType,
  timeSec: number,
  furniture: PlacedFurniture[]
): void {
  if (timeOfDay === 'day' && weather === 'sunny') {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 248, 214, 0.14)';
    ctx.beginPath();
    ctx.moveTo(210, 90);
    ctx.lineTo(306, 90);
    ctx.lineTo(356, 210);
    ctx.lineTo(250, 210);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(610, 90);
    ctx.lineTo(720, 90);
    ctx.lineTo(770, 220);
    ctx.lineTo(650, 220);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (timeOfDay === 'dusk') {
    ctx.save();
    ctx.fillStyle = weather === 'sunny' ? 'rgba(234, 128, 62, 0.15)' : 'rgba(180, 115, 78, 0.12)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.restore();
    return;
  }

  if (timeOfDay !== 'night') {
    return;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(18, 24, 58, 0.40)';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.globalCompositeOperation = 'lighter';
  const warmLights: Array<{ x: number; y: number; r: number; color: string }> = [
    { x: 265, y: 290, r: 150, color: 'rgba(255, 200, 115, 0.20)' },
    { x: 350, y: 710, r: 190, color: 'rgba(255, 195, 110, 0.22)' },
    { x: 660, y: 270, r: 170, color: 'rgba(255, 225, 165, 0.18)' },
  ];

  for (const item of furniture) {
    if (item.type === 'computer') {
      warmLights.push({
        x: item.x,
        y: item.y,
        r: 90,
        color: 'rgba(96, 165, 250, 0.22)',
      });
    }
  }

  for (const light of warmLights) {
    const grad = ctx.createRadialGradient(light.x, light.y, 10, light.x, light.y, light.r);
    grad.addColorStop(0, light.color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (weather !== 'rainy') {
    for (let i = 0; i < 20; i++) {
      const baseFx = i < 6 ? 915 + ((i * 67) % 340) : 890 + ((i * 173) % 455);
      const baseFy = i < 6 ? 675 + ((i * 43) % 145) : 95 + ((i * 227) % 800);
      const fx = baseFx + Math.sin(timeSec * (0.85 + (i % 3) * 0.18) + i * 1.3) * 20;
      const fy = baseFy + Math.cos(timeSec * (1.05 + (i % 4) * 0.14) + i * 2.1) * 16;
      const pulse = 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * (2.6 + (i % 5) * 0.5) + i * 1.9), 1.6);

      const halo = ctx.createRadialGradient(fx, fy, 0.5, fx, fy, 11);
      halo.addColorStop(0, `rgba(217, 249, 157, ${(pulse * 0.72).toFixed(2)})`);
      halo.addColorStop(0.45, `rgba(190, 242, 100, ${(pulse * 0.34).toFixed(2)})`);
      halo.addColorStop(1, 'rgba(190, 242, 100, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(fx, fy, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(254, 249, 195, ${(0.35 + pulse * 0.65).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawDaytimeBreezeParticles(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  weather: WeatherType,
  timeSec: number
): void {
  if (timeOfDay === 'night' || weather === 'rainy') return;

  ctx.save();
  const colors = ['#74B752', '#95D06B', '#FBCFE8', '#FEF3C7', '#86EFAC'];
  const count = 18;
  for (let i = 0; i < count; i++) {
    const speedX = 18 + (i % 4) * 7;
    const speedY = 10 + (i % 3) * 5;
    const px = ((i * 157 + timeSec * speedX) % (WORLD_WIDTH - 40)) + 20;
    const py =
      ((i * 211 + timeSec * speedY + Math.sin(timeSec * 1.4 + i) * 18) % (WORLD_HEIGHT - 60)) + 30;

    // Keep breeze leaves/petals outdoors around the yard & garden
    const insideHouse = px > 80 && px < 868 && py > 80 && py < 928;
    if (insideHouse) continue;

    const isPetal = i % 3 === 1;
    const rot = timeSec * (1.2 + (i % 3) * 0.4) + i;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.globalAlpha = timeOfDay === 'dusk' ? 0.58 : 0.72;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    if (isPetal) {
      ctx.ellipse(0, 0, 4.4, 2.7, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(0, -3.8, 5, 0);
      ctx.quadraticCurveTo(0, 3.8, -5, 0);
    }
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawGardenButterflies(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  weather: WeatherType,
  timeSec: number
): void {
  if (timeOfDay !== 'day' || weather === 'rainy') return;

  const butterflies = [
    { cx: 985, cy: 720, rx: 46, ry: 28, speed: 0.95, wingColor: '#FB923C', trimColor: '#FEF3C7', phase: 0.4 },
    { cx: 1110, cy: 705, rx: 52, ry: 30, speed: 0.82, wingColor: '#38BDF8', trimColor: '#E0F2FE', phase: 2.3 },
    { cx: 1215, cy: 730, rx: 42, ry: 26, speed: 1.08, wingColor: '#F472B6', trimColor: '#FCE7F3', phase: 4.1 },
  ];

  ctx.save();
  for (let i = 0; i < butterflies.length; i++) {
    const b = butterflies[i];
    const t = timeSec * b.speed + b.phase;
    const bx = b.cx + Math.sin(t) * b.rx;
    const by = b.cy + Math.sin(t * 2) * b.ry * 0.65 - Math.abs(Math.cos(t * 1.3)) * 10;
    const vx = Math.cos(t) * b.rx * b.speed;
    const vy = Math.cos(t * 2) * b.ry * 1.3 * b.speed;
    const heading = Math.atan2(vy, vx);
    const flap = 0.28 + 0.72 * Math.abs(Math.sin(timeSec * 13 + i * 2.1));

    // Tiny ground shadow beneath butterfly
    ctx.fillStyle = 'rgba(20, 15, 10, 0.12)';
    ctx.beginPath();
    ctx.ellipse(bx, by + 18, 4.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(heading + Math.PI / 2);

    // Left & right wings
    ctx.fillStyle = b.wingColor;
    ctx.beginPath();
    ctx.ellipse(-4.2 * flap, -1, 5.2 * flap, 3.6, -0.35, 0, Math.PI * 2);
    ctx.ellipse(4.2 * flap, -1, 5.2 * flap, 3.6, 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.trimColor;
    ctx.beginPath();
    ctx.ellipse(-3.6 * flap, 2.4, 3.5 * flap, 2.4, 0.3, 0, Math.PI * 2);
    ctx.ellipse(3.6 * flap, 2.4, 3.5 * flap, 2.4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.strokeStyle = '#3E2A1E';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -3.5);
    ctx.lineTo(0, 4);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();
}

function drawWeatherLayer(
  ctx: CanvasRenderingContext2D,
  weather: WeatherType,
  timeSec: number
): void {
  if (weather === 'sunny') return;

  if (weather === 'cloudy') {
    ctx.save();
    ctx.fillStyle = 'rgba(130, 148, 170, 0.14)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Gentle drifting cloud shadows over the yard
    ctx.fillStyle = 'rgba(65, 82, 105, 0.09)';
    for (let c = 0; c < 4; c++) {
      const cx = ((timeSec * (14 + c * 3) + c * 380) % (WORLD_WIDTH + 320)) - 160;
      const cy = 140 + c * 220;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 130, 56, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Rainy weather: slight ambient darkening + animated raindrops & yard splashes
  ctx.save();
  ctx.fillStyle = 'rgba(26, 45, 74, 0.22)';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Subtle warm cozy indoor glow while it rains outside
  ctx.fillStyle = 'rgba(255, 224, 168, 0.10)';
  ctx.fillRect(92, 92, 760, 820);

  // Animated diagonal raindrops (stronger outdoors, sparse soft streaks over house roof edges)
  ctx.lineCap = 'round';
  const dropCount = 150;
  for (let i = 0; i < dropCount; i++) {
    const speed = 380 + (i % 5) * 45;
    const rawX = (i * 193 + timeSec * 75) % (WORLD_WIDTH + 120);
    const rawY = (i * 149 + timeSec * speed) % (WORLD_HEIGHT + 80);
    const rx = rawX - 40;
    const ry = rawY - 40;

    const insideHouse = rx > 88 && rx < 855 && ry > 88 && ry < 915;
    if (insideHouse) continue;

    ctx.strokeStyle = i % 3 === 0 ? 'rgba(186, 230, 253, 0.62)' : 'rgba(147, 197, 253, 0.45)';
    ctx.lineWidth = i % 4 === 0 ? 1.8 : 1.3;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 5, ry + 16);
    ctx.stroke();

    // Occasional water splash ripple on yard grass/ground
    if (i % 7 === 0) {
      const splashPhase = (timeSec * 2.2 + i * 0.37) % 1;
      const sx = 900 + ((i * 137) % 450);
      const sy = 80 + ((i * 211) % 840);
      ctx.strokeStyle = `rgba(186, 230, 253, ${((1 - splashPhase) * 0.42).toFixed(2)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3 + splashPhase * 7, 1.5 + splashPhase * 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHeartParticles(ctx: CanvasRenderingContext2D, hearts: HeartParticle[]): void {
  for (const h of hearts) {
    const progress = 1 - h.timer / h.maxTimer;
    const alpha = Math.max(0, 1 - progress * progress);
    const kind = h.kind ?? 'heart';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(h.x, h.y);

    if (kind === 'star') {
      const s = h.size * (0.85 + Math.sin(progress * Math.PI) * 0.35);
      ctx.rotate(progress * 2.2);
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let p = 0; p < 10; p++) {
        const ang = (p * Math.PI) / 5 - Math.PI / 2;
        const r = p % 2 === 0 ? s : s * 0.45;
        const sx = Math.cos(ang) * r;
        const sy = Math.sin(ang) * r;
        if (p === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'water') {
      const s = h.size * (1 - progress * 0.25);
      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.78, -s * 0.05, s * 0.72, s * 0.85, 0, s * 0.85);
      ctx.bezierCurveTo(-s * 0.72, s * 0.85, -s * 0.78, -s * 0.05, 0, -s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(-s * 0.18, s * 0.15, Math.max(1, s * 0.18), 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'dust') {
      const s = h.size * (0.75 + progress * 0.75);
      ctx.fillStyle = `rgba(226, 214, 194, ${(alpha * 0.65).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const s = h.size * (0.85 + progress * 0.3);
      ctx.fillStyle = '#FB7185';
      ctx.strokeStyle = '#BE123C';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(-s * 0.6, -s * 0.3, -s, s * 0.2, 0, s);
      ctx.bezierCurveTo(s, s * 0.2, s * 0.6, -s * 0.3, 0, s * 0.35);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function renderWorldCanvas(opts: RenderOptions): void {
  const {
    ctx,
    viewportWidth,
    viewportHeight,
    cameraX,
    cameraY,
    zoom,
    timeSec,
    timeOfDay,
    weather,
    pet,
    furniture,
    gardenPlots,
    activeSeedToPlant,
    hoveredPlotId,
    hoveredGate,
    placingType,
    hoverWorldPos,
    canPlaceAtHover,
    hoveredFurnitureId,
    selectedFurnitureId,
    notices,
    hearts,
  } = opts;

  ctx.save();
  ctx.fillStyle =
    timeOfDay === 'night'
      ? '#13172B'
      : weather === 'rainy'
        ? '#23322D'
        : '#2E3B2B';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.translate(viewportWidth / 2, viewportHeight / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);

  drawFloors(ctx, timeSec);
  drawGardenPlots(ctx, gardenPlots, activeSeedToPlant, hoveredPlotId, timeSec);
  drawWorkGate(ctx, pet, hoveredGate);
  drawStaticProps(ctx, timeSec);
  drawWalls(ctx);

  const sortedFurniture = [...furniture].sort((a, b) => a.y - b.y);
  for (const item of sortedFurniture) {
    const petUsingThis =
      pet.targetFurnitureId === item.id &&
      (pet.state === 'PAINTING' ||
        pet.state === 'INSPIRING' ||
        pet.state === 'BROWSING' ||
        pet.state === 'WRITING_DIARY' ||
        pet.state === 'PLAYING_BALL' ||
        pet.state === 'EATING' ||
        pet.state === 'SLEEPING');

    drawFurnitureItem(
      ctx,
      item,
      timeSec,
      hoveredFurnitureId === item.id,
      selectedFurnitureId === item.id,
      petUsingThis
    );
  }

  if (placingType && hoverWorldPos) {
    const previewItem: PlacedFurniture = {
      id: 'preview',
      type: placingType,
      x: hoverWorldPos.x,
      y: hoverWorldPos.y,
      foodStock: 4,
      maxFoodStock: 4,
    };
    const r = FURNITURE_CATALOG[placingType].radius + 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hoverWorldPos.x, hoverWorldPos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = canPlaceAtHover ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.25)';
    ctx.fill();
    ctx.strokeStyle = canPlaceAtHover ? '#10B981' : '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    drawFurnitureItem(ctx, previewItem, timeSec, false, false, false, 0.72);
  }

  drawPet(ctx, pet, timeSec);
  drawGardenButterflies(ctx, timeOfDay, weather, timeSec);
  drawDaytimeBreezeParticles(ctx, timeOfDay, weather, timeSec);
  drawHeartParticles(ctx, hearts);
  drawLightingOverlay(ctx, timeOfDay, weather, timeSec, furniture);
  drawWeatherLayer(ctx, weather, timeSec);

  for (const n of notices) {
    const progress = 1 - n.timer / n.maxTimer;
    const alpha = Math.max(0, 1 - progress);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = 'rgba(20, 15, 10, 0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(n.text, n.x, n.y - progress * 28);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.x, n.y - progress * 28);
    ctx.restore();
  }

  ctx.restore();
}
