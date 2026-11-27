import type {
  ComputerActivity,
  GardenPlot,
  LeisureActivityKey,
  PetState,
  PlacedFurniture,
  TimeOfDay,
  Vec2,
  WeatherType,
  WorkGig,
} from '../types/game';
import {
  findPath,
  getRandomIndoorWalkablePoint,
  getRandomWalkablePoint,
  getZoneNameAt,
  INDOOR_WINDOW_SPOTS,
  isPointBlocked,
  WORK_GATE,
} from './mapData';

const HUNGER_COMPLAINTS = [
  'Meu estômago tá roncando alto...',
  'Ei, humano, esqueceram de mim?',
  'A tigela tá vazia... socorro!',
  'Só um lanchinho, por favor?',
];

const WANDER_THOUGHTS_DAY = [
  'Que dia gostoso para passear!',
  'Adoro explorar cada cantinho.',
  'O que será que tem para fazer?',
];

const WANDER_THOUGHTS_NIGHT = [
  'Os vaga-lumes no quintal são lindos...',
  'A casa fica tão calma à noite.',
  'Será que já é hora de dormir?',
];

const WANDER_THOUGHTS_RAIN = [
  'Adoro o barulhinho da chuva lá fora...',
  'Olhando as gotinhas na janela!',
  'Dia de chuva combina com ficar quentinho em casa.',
];

export const SEEK_PLAYER_TARGET_ID = '__SEEK_PLAYER__';

export function startPetAffectionWalk(
  pet: PetState,
  reason: 'welcome_back' | 'low_mental'
): void {
  if (pet.state === 'WORKING') return;
  pet.targetFurnitureId = SEEK_PLAYER_TARGET_ID;
  pet.targetPlotId = null;
  pet.activeComputerActivity = null;
  pet.affectionSeekCooldown = 85;

  const frontY = Math.min(885, pet.y + 52);
  const goal: Vec2 = !isPointBlocked(pet.x, frontY, 18)
    ? { x: pet.x, y: frontY }
    : { x: 430, y: 710 };

  pet.path = findPath(pet, goal);
  pet.state = 'WALKING_TO_OBJECT';
  pet.isLookingAtScreen = true;
  pet.bubbleText =
    reason === 'welcome_back'
      ? 'Que saudade!! Que bom que você voltou!'
      : 'Ei humano... tô meio carente, vem me dar atenção?';
  pet.bubbleKind = 'speech';
  pet.bubbleTimer = 4.8;
}

export interface PetTickCallbacks {
  onConsumeFood: (furnitureId: string) => void;
  onHarvestPlot: (plotId: string, seed: 'carrot' | 'tomato' | 'sunflower') => void;
  onFinishWork: (rewardCoins: number, gigTitle: string) => void;
  onStartPainting: (petSnapshot: PetState) => void;
  onStartDiscovery: (petSnapshot: PetState) => void;
  onStartDiary: (petSnapshot: PetState) => void;
  onPlayEatSound: () => void;
  onPlayKickSound: () => void;
  onIdleAffinityDecay?: (loss: number) => void;
}

export function pushPetMemory(pet: PetState, eventText: string): void {
  const cleaned = eventText.trim().slice(0, 120);
  if (!cleaned) return;
  if (pet.recentEvents[0] === cleaned) return;
  pet.recentEvents = [cleaned, ...pet.recentEvents].slice(0, 8);
}

export function describePetMood(pet: PetState): string {
  if (pet.grumpyTimer > 0 || pet.affinity < 40) return 'emburrado e magoado';
  if (pet.hunger < 35) return 'faminto e dramático';
  if (pet.health < 40) return 'meio sedentário e abatido';
  if (pet.energy < 30) return 'sonolento e aconchegado';
  if (pet.mentalEnergy < 20) return 'mentalmente cansado';
  if (pet.inspiration > 75) return 'super inspirado e criativo';
  if (pet.boredom > 50) return 'entediado procurando algo novo';
  return 'feliz, curioso e tranquilo';
}

export function sendPetToWork(
  pet: PetState,
  gig: WorkGig
): { accepted: boolean; exploitedPenalty: number; reason?: 'grumpy' } {
  if (pet.affinity < 40) {
    pet.grumpyTimer = Math.max(pet.grumpyTimer, 16);
    pet.isLookingAtScreen = true;
    pet.bubbleText = 'Não vou trabalhar! Primeiro reconquiste minha confiança... Hmph!';
    pet.bubbleKind = 'speech';
    pet.bubbleTimer = 4.2;
    pet.pendingDiaryEntry = true;
    pushPetMemory(pet, 'Recusei trabalhar porque estou emburrado e sem confiança no humano.');
    return { accepted: false, exploitedPenalty: 0, reason: 'grumpy' };
  }

  pet.targetFurnitureId = null;
  pet.targetPlotId = null;
  pet.activeComputerActivity = null;
  pet.interactionPauseTimer = 0;
  pet.secondsWithoutAttention = 0;
  pet.activeWorkReward = gig.rewardCoins;
  pet.activeWorkLabel = gig.title;
  pet.stateTimer = gig.durationSec;
  pet.path = findPath(pet, { x: WORK_GATE.approachX, y: WORK_GATE.approachY });
  pet.state = 'WALKING_TO_OBJECT';

  let exploitedPenalty = 0;
  if (pet.hunger < 30 || pet.energy < 30) {
    exploitedPenalty = pet.hunger < 30 && pet.energy < 30 ? 8 : 6;
    pet.affinity = Math.max(0, pet.affinity - exploitedPenalty);
    pet.grumpyTimer = Math.max(pet.grumpyTimer, 22);
    pet.bubbleText =
      pet.hunger < 30
        ? 'Isso é exploração! Tô morrendo de fome e ainda tenho que trabalhar?!'
        : 'Isso é exploração! Tô exausto e você me manda trabalhar?!';
    pushPetMemory(
      pet,
      `Fui mandado trabalhar como ${gig.title} mesmo com fome/exausto. Me senti explorado!`
    );
  } else if (pet.traits.preguicoso >= 45 && pet.traits.trabalhador < 45) {
    pet.bubbleText = 'Aff... trabalhar de novo?! Que preguiça...';
    pushPetMemory(pet, `Fui trabalhar como ${gig.title} mesmo com preguiça.`);
  } else {
    pet.bubbleText = `Partiu ${gig.title}!`;
    pushPetMemory(pet, `Fui trabalhar na cidade como ${gig.title}.`);
  }
  pet.bubbleKind = 'speech';
  pet.bubbleTimer = 3.8;

  pet.energy = Math.max(5, pet.energy - gig.energyCost);
  pet.mentalEnergy = Math.max(5, pet.mentalEnergy - gig.mentalCost);
  pet.health = Math.max(10, Math.min(100, pet.health + gig.healthDelta));
  pet.workCount += 1;
  pet.traits.trabalhador = Math.min(100, pet.traits.trabalhador + 8);
  pet.traits.preguicoso = Math.max(0, pet.traits.preguicoso - 6);
  pet.traits[gig.traitBoost] = Math.min(100, pet.traits[gig.traitBoost] + 2);
  pet.pendingDiaryEntry = true;

  return { accepted: true, exploitedPenalty };
}

function findClosestFurniture(
  pet: Vec2,
  furniture: PlacedFurniture[],
  predicate: (item: PlacedFurniture) => boolean
): PlacedFurniture | null {
  let best: PlacedFurniture | null = null;
  let bestDist = Infinity;
  for (const item of furniture) {
    if (!predicate(item)) continue;
    const d = Math.hypot(item.x - pet.x, item.y - pet.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

function getApproachPoint(item: PlacedFurniture): Vec2 {
  const candidates: Vec2[] =
    item.type === 'bed' || item.type === 'mat'
      ? [{ x: item.x, y: item.y + 2 }]
      : item.type === 'fridge'
        ? [
            { x: item.x - 22, y: item.y + 38 },
            { x: item.x + 36, y: item.y + 18 },
            { x: item.x, y: item.y + 42 },
          ]
        : [
            { x: item.x, y: item.y + 34 },
            { x: item.x - 34, y: item.y + 12 },
            { x: item.x + 34, y: item.y + 12 },
            { x: item.x, y: item.y - 34 },
          ];

  for (const c of candidates) {
    if (!isPointBlocked(c.x, c.y, 16)) {
      return c;
    }
  }
  return { x: item.x, y: item.y + 34 };
}

function chooseComputerActivity(pet: PetState): ComputerActivity {
  const highGamerNerd = pet.traits.nerd >= 65;
  const weights: Array<{ act: ComputerActivity; w: number }> = [
    {
      act: 'gaming',
      w: 20 + pet.traits.nerd * 0.48 + pet.traits.preguicoso * 0.3 + (highGamerNerd ? 25 : 0),
    },
    { act: 'videos', w: 22 + pet.traits.preguicoso * 0.4 },
    { act: 'research', w: 24 + pet.traits.curioso * 0.5 + pet.traits.filosofo * 0.3 },
    { act: 'sus', w: 14 + pet.traits.curioso * 0.2 },
  ];
  if (pet.mentalEnergy <= 15) {
    // Low mental energy favors relaxing videos over deep research
    weights[2].w = 0;
  }
  const total = weights.reduce((s, item) => s + item.w, 0);
  let r = Math.random() * total;
  for (const item of weights) {
    r -= item.w;
    if (r <= 0) return item.act;
  }
  return 'videos';
}

function recordActivityUse(
  pet: PetState,
  activity: LeisureActivityKey,
  usedItem?: PlacedFurniture | null
): void {
  if (pet.lastUsedActivityType === activity) {
    pet.consecutiveUseCount = (pet.consecutiveUseCount || 0) + 1;
  } else {
    pet.lastUsedActivityType = activity;
    pet.consecutiveUseCount = 1;
  }

  const prevSat = pet.satiationMap?.[activity] ?? 0;
  // Consecutive repeats saturate slightly faster unless Gamer/Nerd is high on PC
  const step =
    activity === 'computer' && pet.traits.nerd >= 65
      ? 0.1
      : 0.32 + Math.min(0.18, (pet.consecutiveUseCount - 1) * 0.08);

  pet.satiationMap = {
    ...(pet.satiationMap ?? {}),
    [activity]: Math.min(1, prevSat + step),
  };

  if (usedItem && typeof usedItem.noveltyBoost === 'number' && usedItem.noveltyBoost > 0) {
    usedItem.noveltyBoost = Math.max(0, usedItem.noveltyBoost - 0.28);
  }
}

function setBubble(
  pet: PetState,
  text: string,
  kind: 'speech' | 'thought' | 'icon' = 'speech',
  duration = 3.6
): void {
  pet.bubbleText = text;
  pet.bubbleKind = kind;
  pet.bubbleTimer = duration;
}

export function stepPetSimulation(
  pet: PetState,
  furniture: PlacedFurniture[],
  gardenPlots: GardenPlot[],
  coins: number,
  dtReal: number,
  timeScale: number,
  timeOfDay: TimeOfDay,
  weather: WeatherType,
  isPaintingApiBusy: boolean,
  isDiscoveryApiBusy: boolean,
  isDiaryApiBusy: boolean,
  callbacks: PetTickCallbacks
): void {
  const dt = Math.min(dtReal * timeScale, 0.12);

  // Blinking
  pet.blinkTimer -= dtReal;
  if (pet.blinkTimer <= 0) {
    if (pet.isBlinking) {
      pet.isBlinking = false;
      pet.blinkTimer = 2.4 + Math.random() * 2.8;
    } else {
      pet.isBlinking = true;
      pet.blinkTimer = 0.13;
    }
  }

  // Cooldowns (AI API cooldowns tick in real seconds so 5x speed does not spam API quota)
  if (pet.paintCooldown > 0) pet.paintCooldown = Math.max(0, pet.paintCooldown - dtReal);
  if (pet.computerCooldown > 0) pet.computerCooldown = Math.max(0, pet.computerCooldown - dtReal);
  if (pet.diaryCooldown > 0) pet.diaryCooldown = Math.max(0, pet.diaryCooldown - dtReal);
  if (pet.ballCooldown > 0) pet.ballCooldown = Math.max(0, pet.ballCooldown - dt);
  if (pet.workCooldown > 0) pet.workCooldown = Math.max(0, pet.workCooldown - dt);
  if (pet.grumpyTimer > 0) pet.grumpyTimer = Math.max(0, pet.grumpyTimer - dtReal);
  if (pet.happyEyesTimer > 0) pet.happyEyesTimer = Math.max(0, pet.happyEyesTimer - dtReal);
  if (pet.interactionPauseTimer > 0) {
    pet.interactionPauseTimer = Math.max(0, pet.interactionPauseTimer - dtReal);
  }
  if (pet.affectionSeekCooldown > 0) {
    pet.affectionSeekCooldown = Math.max(0, pet.affectionSeekCooldown - dtReal);
  }
  if (pet.petCooldownSlots && pet.petCooldownSlots.length > 0) {
    pet.petCooldownSlots = pet.petCooldownSlots
      .map((sec) => sec - dt)
      .filter((sec) => sec > 0);
  }
  if (pet.praiseCooldownSlots && pet.praiseCooldownSlots.length > 0) {
    pet.praiseCooldownSlots = pet.praiseCooldownSlots
      .map((sec) => sec - dt)
      .filter((sec) => sec > 0);
  }

  // Natural recovery of satiation & slow decay of furniture novelty
  if (pet.satiationMap) {
    const keys: LeisureActivityKey[] = ['easel', 'computer', 'ball', 'diary', 'garden'];
    for (const k of keys) {
      const val = pet.satiationMap[k];
      if (typeof val === 'number' && val > 0) {
        pet.satiationMap[k] = Math.max(0, val - 0.015 * dt);
      }
    }
  }
  for (const item of furniture) {
    if (typeof item.noveltyBoost === 'number' && item.noveltyBoost > 0) {
      item.noveltyBoost = Math.max(0, item.noveltyBoost - 0.006 * dtReal);
    }
  }

  if (pet.bubbleTimer > 0) {
    pet.bubbleTimer -= dtReal;
    if (pet.bubbleTimer <= 0) {
      pet.bubbleText = null;
    }
  }

  // Work state runs in real/accelerated time with 70% slower hunger & energy metabolism
  if (pet.state === 'WORKING') {
    pet.vx = 0;
    pet.vy = 0;
    pet.hunger = Math.max(0, pet.hunger - 0.6 * 0.3 * dt);
    pet.energy = Math.max(0, pet.energy - 0.48 * 0.3 * dt);
    pet.stateTimer -= dt;
    if (pet.stateTimer <= 0) {
      const reward = pet.activeWorkReward || 14;
      const label = pet.activeWorkLabel || 'Bico na cidade';
      pet.x = WORK_GATE.approachX;
      pet.y = WORK_GATE.approachY;
      pet.state = 'WANDERING';
      pet.activeWorkReward = 0;
      pet.activeWorkLabel = null;
      pet.workCooldown = 25;
      pet.stateTimer = 1.5;
      setBubble(pet, `Voltei! Ganhei +${reward} moedas!`, 'speech', 3.8);
      callbacks.onFinishWork(reward, label);
    }
    return;
  }

  // Need rates
  if (pet.state !== 'EATING') {
    pet.hunger = Math.max(0, pet.hunger - 0.6 * dt);
  }
  if (pet.state !== 'SLEEPING') {
    pet.energy = Math.max(0, pet.energy - 0.48 * dt);
  }
  if (
    pet.state !== 'PAINTING' &&
    pet.state !== 'INSPIRING' &&
    pet.state !== 'BROWSING' &&
    pet.state !== 'WRITING_DIARY' &&
    pet.state !== 'PLAYING_BALL'
  ) {
    pet.boredom = Math.min(100, pet.boredom + 1.1 * dt);
  }

  // Realistic affinity decay: -1 every 3 minutes (180s) without player interaction, plus neglect
  pet.secondsWithoutAttention = (pet.secondsWithoutAttention ?? 0) + dtReal;
  if (pet.secondsWithoutAttention >= 180) {
    const ticks = Math.floor(pet.secondsWithoutAttention / 180);
    pet.secondsWithoutAttention -= ticks * 180;
    const prevAff = pet.affinity;
    pet.affinity = Math.max(0, pet.affinity - ticks);
    const actualLoss = Math.max(0, Math.round(prevAff - pet.affinity));
    if (actualLoss > 0) {
      setBubble(pet, 'Ei... tô me sentindo meio esquecido aqui...', 'thought', 3.4);
      pushPetMemory(pet, 'Fiquei esperando você interagir comigo por um bom tempo.');
      callbacks.onIdleAffinityDecay?.(actualLoss);
    }
  }
  if (pet.hunger < 20 && pet.state !== 'EATING') {
    pet.affinity = Math.max(0, pet.affinity - 0.45 * dtReal);
  }
  if (pet.energy < 15 && pet.state !== 'SLEEPING') {
    pet.affinity = Math.max(0, pet.affinity - 0.35 * dtReal);
  }

  // Sedentary health effect vs outdoor walking
  if (pet.state === 'BROWSING' && pet.activeComputerActivity === 'gaming') {
    pet.health = Math.max(10, pet.health - 0.8 * dt);
  } else if (pet.state === 'SLEEPING') {
    // Gentle sedentary drift if only sleeping/PC without play
    if (pet.workCount === 0 && pet.traits.preguicoso < 65) {
      pet.traits.preguicoso = Math.min(65, pet.traits.preguicoso + 0.14 * dt);
    }
  } else if (pet.state === 'WANDERING') {
    pet.inspiration = Math.min(85, pet.inspiration + 0.4 * dt);
    pet.mentalEnergy = Math.min(100, pet.mentalEnergy + 0.45 * dt);
    const zone = getZoneNameAt(pet.x, pet.y);
    if (zone === 'Quintal') {
      pet.health = Math.min(100, pet.health + 0.2 * dt);
    } else {
      pet.health = Math.max(15, pet.health - 0.08 * dt);
    }
    if (pet.workCount === 0 && pet.traits.preguicoso < 55) {
      pet.traits.preguicoso = Math.min(55, pet.traits.preguicoso + 0.06 * dt);
    }
  } else if (pet.state === 'INSPIRING' || pet.state === 'PAINTING') {
    pet.inspiration = Math.min(100, pet.inspiration + 12 * dt);
  }

  // Validate target furniture still exists
  if (pet.targetFurnitureId && pet.targetFurnitureId !== SEEK_PLAYER_TARGET_ID) {
    const stillExists = furniture.some((f) => f.id === pet.targetFurnitureId);
    if (
      !stillExists &&
      pet.state !== 'PAINTING' &&
      pet.state !== 'BROWSING' &&
      pet.state !== 'WRITING_DIARY'
    ) {
      pet.targetFurnitureId = null;
      pet.path = [];
      pet.state = 'WANDERING';
      pet.stateTimer = 0.5;
      pet.isLookingAtScreen = false;
    }
  }

  // Pause pet movement smoothly when tapped or actively interacting via radial menu
  if (
    pet.interactionPauseTimer > 0 &&
    (pet.state === 'WANDERING' ||
      pet.state === 'WALKING_TO_OBJECT' ||
      pet.state === 'CALLING_PLAYER')
  ) {
    pet.vx = 0;
    pet.vy = 0;
    pet.isLookingAtScreen = true;
    return;
  }

  switch (pet.state) {
    case 'CALLING_PLAYER': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = true;
      pet.stateTimer -= dtReal;
      if (pet.stateTimer <= 0) {
        pet.isLookingAtScreen = false;
        pet.state = 'WANDERING';
        pet.stateTimer = 1.5;
      }
      return;
    }

    case 'EATING': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = false;
      pet.hunger = Math.min(100, pet.hunger + 22 * dt);
      pet.stateTimer -= dt;
      if (pet.stateTimer <= 0 || pet.hunger >= 96) {
        pet.state = 'WANDERING';
        pet.targetFurnitureId = null;
        pet.stateTimer = 2.0;
        setBubble(pet, 'Barriguinha cheia, que delícia!', 'speech', 3.0);
      }
      return;
    }

    case 'SLEEPING': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = false;
      const bedItem = furniture.find((f) => f.id === pet.targetFurnitureId);
      const isComfyBed = bedItem?.type === 'bed';
      const isMat = bedItem?.type === 'mat';
      pet.energy = Math.min(100, pet.energy + (isComfyBed ? 14 : isMat ? 9.5 : 5.5) * dt);
      pet.mentalEnergy = Math.min(
        100,
        pet.mentalEnergy + (isComfyBed ? 17 : isMat ? 10 : 5) * dt
      );
      pet.boredom = Math.max(0, pet.boredom - 1.5 * dt);
      if (pet.energy >= 96 || (!bedItem && pet.energy >= 45)) {
        pet.state = 'WANDERING';
        pet.targetFurnitureId = null;
        pet.stateTimer = 1.5;
        setBubble(pet, 'Dormi bem! Cabeça renovada!', 'speech', 2.8);
      }
      return;
    }

    case 'INSPIRING': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = false;
      pet.stateTimer -= dt;
      if (pet.stateTimer <= 0) {
        pet.state = 'PAINTING';
        pet.stateTimer = 3.5;
        pet.boredom = 0;
        pet.mentalEnergy = Math.max(0, pet.mentalEnergy - 18);
        pet.pendingDiaryEntry = true;
        setBubble(pet, 'Pintando minha nova obra...', 'thought', 5.0);
        callbacks.onStartPainting({ ...pet });
      }
      return;
    }

    case 'PAINTING': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = false;
      pet.stateTimer -= dtReal;
      if (pet.stateTimer <= 0 && !isPaintingApiBusy) {
        pet.state = 'WANDERING';
        pet.targetFurnitureId = null;
        pet.paintCooldown = Math.max(pet.paintCooldown, 60);
        pet.stateTimer = 2.0;
      }
      return;
    }

    case 'BROWSING': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = false;
      pet.boredom = Math.max(0, pet.boredom - 14 * dt);

      if (pet.activeComputerActivity === 'videos') {
        pet.mentalEnergy = Math.min(100, pet.mentalEnergy + 3.4 * dt);
      } else if (pet.activeComputerActivity === 'gaming') {
        pet.inspiration = Math.min(100, pet.inspiration + 4 * dt);
      }

      pet.stateTimer -= dtReal;
      if (
        pet.stateTimer <= 0 &&
        (pet.activeComputerActivity !== 'research' || !isDiscoveryApiBusy)
      ) {
        const finishedAct = pet.activeComputerActivity;
        pet.activeComputerActivity = null;
        pet.state = 'WANDERING';
        pet.targetFurnitureId = null;
        pet.computerCooldown = Math.max(pet.computerCooldown, 50);
        pet.stateTimer = 1.5;
        if (finishedAct === 'videos') {
          setBubble(pet, 'Que vídeo relaxante!', 'speech', 2.8);
        } else if (finishedAct === 'gaming') {
          pet.traits.nerd = Math.min(100, pet.traits.nerd + 1.5);
          setBubble(pet, 'Uhuul, bati meu recorde!', 'speech', 2.8);
        } else if (finishedAct === 'sus') {
          setBubble(pet, 'Ninguém viu nada... hehehe', 'thought', 2.6);
        }
      }
      return;
    }

    case 'WRITING_DIARY': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = false;
      pet.stateTimer -= dtReal;
      if (pet.stateTimer <= 0 && !isDiaryApiBusy) {
        pet.state = 'WANDERING';
        pet.targetFurnitureId = null;
        pet.diaryCooldown = Math.max(pet.diaryCooldown, 75);
        pet.pendingDiaryEntry = false;
        pet.stateTimer = 1.8;
        setBubble(pet, 'Pronto... segredinho guardado.', 'thought', 2.8);
      }
      return;
    }

    case 'PLAYING_BALL': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = false;
      pet.health = Math.min(100, pet.health + 4 * dt);
      pet.inspiration = Math.min(100, pet.inspiration + 5 * dt);
      pet.boredom = Math.max(0, pet.boredom - 12 * dt);
      pet.stateTimer -= dt;
      if (pet.stateTimer <= 0) {
        pet.state = 'WANDERING';
        pet.targetFurnitureId = null;
        pet.ballCooldown = 22;
        pet.stateTimer = 1.5;
        setBubble(pet, 'Que partida boa! Tô cheio de saúde!', 'speech', 2.8);
      }
      return;
    }

    case 'HARVESTING_GARDEN': {
      pet.vx = 0;
      pet.vy = 0;
      pet.stateTimer -= dt;
      if (pet.stateTimer <= 0) {
        const plot = gardenPlots.find((p) => p.id === pet.targetPlotId);
        if (plot && plot.seed && plot.stage === 3) {
          callbacks.onHarvestPlot(plot.id, plot.seed);
          if (plot.seed === 'sunflower') {
            pet.inspiration = Math.min(100, pet.inspiration + 20);
            pet.mentalEnergy = Math.min(100, pet.mentalEnergy + 14);
            setBubble(pet, 'Que girassol radiante!', 'speech', 3.0);
          } else {
            const hungerGain = plot.seed === 'tomato' ? 35 : 30;
            const healthGain = plot.seed === 'tomato' ? 18 : 15;
            pet.hunger = Math.min(100, pet.hunger + hungerGain);
            pet.health = Math.min(100, pet.health + healthGain);
            callbacks.onPlayEatSound();
            setBubble(pet, 'Fresquinho da horta! Delícia!', 'speech', 3.0);
          }
        }
        pet.targetPlotId = null;
        pet.state = 'WANDERING';
        pet.stateTimer = 1.5;
      }
      return;
    }

    case 'HUNGRY_COMPLAINT': {
      pet.vx = 0;
      pet.vy = 0;
      pet.isLookingAtScreen = true;
      pet.stateTimer -= dt;

      const stockedFridge = findClosestFurniture(
        pet,
        furniture,
        (f) => f.type === 'fridge' && f.foodStock > 0
      );
      if (stockedFridge) {
        pet.isLookingAtScreen = false;
        pet.targetFurnitureId = stockedFridge.id;
        pet.path = findPath(pet, getApproachPoint(stockedFridge));
        pet.state = 'WALKING_TO_OBJECT';
        setBubble(pet, 'Eba! Comida!', 'speech', 2.4);
        return;
      }

      if (pet.stateTimer <= 0) {
        pet.stateTimer = 4.6;
        pet.affinity = Math.max(0, pet.affinity - 1);
        pet.pendingDiaryEntry = true;
        pushPetMemory(pet, 'Passei fome esperando encherem a minha tigela.');
        const msg =
          HUNGER_COMPLAINTS[Math.floor(Math.random() * HUNGER_COMPLAINTS.length)];
        setBubble(pet, msg, 'speech', 3.6);
      }
      return;
    }

    case 'WALKING_TO_OBJECT': {
      pet.isLookingAtScreen = pet.targetFurnitureId === SEEK_PLAYER_TARGET_ID;
      const arrived = followPath(pet, dt, 128);
      if (arrived) {
        if (pet.targetFurnitureId === SEEK_PLAYER_TARGET_ID) {
          pet.targetFurnitureId = null;
          pet.state = 'CALLING_PLAYER';
          pet.stateTimer = 4.2;
          pet.isLookingAtScreen = true;
          pet.happyEyesTimer = Math.max(pet.happyEyesTimer, 2.2);
          return;
        }
        // Walking to Work Gate?
        if (pet.activeWorkReward > 0) {
          pet.state = 'WORKING';
          // stateTimer already set to gig.durationSec
          return;
        }

        // Walking to ripe Garden Plot?
        if (pet.targetPlotId) {
          const plot = gardenPlots.find((p) => p.id === pet.targetPlotId);
          if (plot && plot.seed && plot.stage === 3) {
            pet.state = 'HARVESTING_GARDEN';
            pet.stateTimer = 2.0;
            setBubble(
              pet,
              plot.seed === 'sunflower' ? 'Admirando o girassol...' : 'Colhendo da horta!',
              'thought',
              2.0
            );
            return;
          }
          pet.targetPlotId = null;
          pet.state = 'WANDERING';
          return;
        }

        const target = furniture.find((f) => f.id === pet.targetFurnitureId);
        if (!target) {
          pet.state = 'WANDERING';
          pet.targetFurnitureId = null;
          pet.stateTimer = 1.0;
          return;
        }

        if (target.type === 'fridge') {
          if (target.foodStock > 0) {
            callbacks.onConsumeFood(target.id);
            callbacks.onPlayEatSound();
            pet.state = 'EATING';
            pet.stateTimer = 3.2;
            setBubble(pet, 'Nhac! Muito gostoso!', 'speech', 3.0);
          } else {
            pet.state = 'HUNGRY_COMPLAINT';
            pet.targetFurnitureId = null;
            pet.stateTimer = 4.0;
            pet.isLookingAtScreen = true;
            setBubble(pet, 'Ué... a geladeira tá vazia!', 'speech', 3.6);
          }
        } else if (target.type === 'bed' || target.type === 'mat') {
          if (typeof target.noveltyBoost === 'number' && target.noveltyBoost > 0) {
            target.noveltyBoost = Math.max(0, target.noveltyBoost - 0.55);
          }
          pet.state = 'SLEEPING';
          pet.stateTimer = 6.0;
          setBubble(pet, 'Zzz...', 'thought', 3.2);
        } else if (target.type === 'easel') {
          recordActivityUse(pet, 'easel', target);
          pet.state = 'INSPIRING';
          pet.stateTimer = 1.6;
          setBubble(pet, 'Tive uma ideia brilhante!', 'thought', 2.4);
        } else if (target.type === 'ball') {
          recordActivityUse(pet, 'ball', target);
          callbacks.onPlayKickSound();
          pet.state = 'PLAYING_BALL';
          pet.stateTimer = 3.8;
          setBubble(pet, 'Chuta pro gol!', 'speech', 3.2);
        } else if (target.type === 'computer') {
          recordActivityUse(pet, 'computer', target);
          const activity = chooseComputerActivity(pet);
          pet.activeComputerActivity = activity;
          pet.state = 'BROWSING';
          pet.stateTimer = 5.2;
          pet.boredom = Math.max(0, pet.boredom - 30);

          if (activity === 'gaming') {
            setBubble(pet, '🎮', 'icon', 5.2);
          } else if (activity === 'videos') {
            setBubble(pet, '▶️', 'icon', 5.2);
          } else if (activity === 'sus') {
            setBubble(pet, '👀', 'icon', 5.4);
          } else {
            pet.mentalEnergy = Math.max(0, pet.mentalEnergy - 12);
            setBubble(pet, '🔍', 'icon', 5.2);
            callbacks.onStartDiscovery({ ...pet });
          }
        } else if (target.type === 'diary') {
          recordActivityUse(pet, 'diary', target);
          pet.state = 'WRITING_DIARY';
          pet.stateTimer = 3.4;
          pet.mentalEnergy = Math.max(0, pet.mentalEnergy - 10);
          pet.pendingDiaryEntry = false;
          setBubble(pet, 'Escrevendo no meu diário secreto...', 'thought', 3.4);
          callbacks.onStartDiary({ ...pet });
        }
      }
      return;
    }

    case 'WANDERING':
    default: {
      pet.isLookingAtScreen = false;

      // Priority 1: Ripe veggie in garden if hungry < 60
      if (pet.hunger < 60) {
        const ripeFoodPlot = gardenPlots.find(
          (p) => p.stage === 3 && (p.seed === 'carrot' || p.seed === 'tomato')
        );
        if (ripeFoodPlot) {
          pet.targetPlotId = ripeFoodPlot.id;
          pet.path = findPath(pet, { x: ripeFoodPlot.x, y: ripeFoodPlot.y + 38 });
          pet.state = 'WALKING_TO_OBJECT';
          setBubble(pet, 'Oba, colheita fresquinha!', 'thought', 2.4);
          return;
        }
      }

      // Priority 2: Hunger < 35%
      if (pet.hunger < 35) {
        const stockedFridge = findClosestFurniture(
          pet,
          furniture,
          (f) => f.type === 'fridge' && f.foodStock > 0
        );
        if (stockedFridge) {
          pet.targetFurnitureId = stockedFridge.id;
          pet.path = findPath(pet, getApproachPoint(stockedFridge));
          pet.state = 'WALKING_TO_OBJECT';
          setBubble(pet, 'Hora do lanchinho!', 'thought', 2.6);
          return;
        } else {
          pet.state = 'HUNGRY_COMPLAINT';
          pet.targetFurnitureId = null;
          pet.path = [];
          pet.stateTimer = 4.0;
          pet.isLookingAtScreen = true;
          const msg =
            HUNGER_COMPLAINTS[Math.floor(Math.random() * HUNGER_COMPLAINTS.length)];
          setBubble(pet, msg, 'speech', 3.8);
          return;
        }
      }

      // Priority 3: Energy < 30% (prefers Bed over Mat)
      if (pet.energy < 30 || (pet.mentalEnergy < 12 && furniture.some((f) => f.type === 'bed' || f.type === 'mat'))) {
        const comfyBed = findClosestFurniture(pet, furniture, (f) => f.type === 'bed');
        const mat = findClosestFurniture(pet, furniture, (f) => f.type === 'mat');
        const sleepSpot = comfyBed ?? mat;
        if (sleepSpot) {
          pet.targetFurnitureId = sleepSpot.id;
          pet.path = findPath(pet, getApproachPoint(sleepSpot));
          pet.state = 'WALKING_TO_OBJECT';
          setBubble(
            pet,
            pet.mentalEnergy < 12 ? 'Cabecinha cansada... indo descansar.' : 'Que soninho... indo deitar.',
            'thought',
            2.8
          );
          return;
        } else if (pet.energy < 16) {
          pet.state = 'SLEEPING';
          pet.targetFurnitureId = null;
          pet.path = [];
          setBubble(pet, 'Queria uma cama macia... Zzz', 'thought', 3.4);
          return;
        }
      }

      // Priority 3.5: Proactive affectionate walk-up when Mental < 40%
      if (
        pet.mentalEnergy < 40 &&
        pet.affectionSeekCooldown <= 0 &&
        pet.affinity >= 40 &&
        pet.hunger >= 35 &&
        pet.energy >= 30
      ) {
        startPetAffectionWalk(pet, 'low_mental');
        return;
      }

      // Priority 4: Autonomous Hardworking Habit (if Trabalhador >= 45 & low coins & rested/fed/trusting)
      if (
        pet.traits.trabalhador >= 45 &&
        pet.affinity >= 40 &&
        coins < 25 &&
        pet.hunger > 35 &&
        pet.energy > 42 &&
        pet.workCooldown <= 0
      ) {
        pet.activeWorkReward = 14;
        pet.activeWorkLabel = 'Entregador Autônomo';
        pet.stateTimer = 45;
        pet.workCount += 1;
        pet.energy = Math.max(15, pet.energy - 14);
        pet.path = findPath(pet, { x: WORK_GATE.approachX, y: WORK_GATE.approachY });
        pet.state = 'WALKING_TO_OBJECT';
        pushPetMemory(pet, 'Fui trabalhar sozinho porque as moedas estavam acabando!');
        setBubble(pet, 'Moedas acabando! Indo trabalhar sozinho!', 'speech', 3.2);
        return;
      }

      // Novelty attraction for a newly placed cozy bed (even if not exhausted yet)
      const novelBed = findClosestFurniture(
        pet,
        furniture,
        (f) => (f.type === 'bed' || f.type === 'mat') && (f.noveltyBoost ?? 0) > 0.55
      );
      if (novelBed && pet.energy < 94) {
        pet.targetFurnitureId = novelBed.id;
        pet.path = findPath(pet, getApproachPoint(novelBed));
        pet.state = 'WALKING_TO_OBJECT';
        setBubble(pet, 'Cama nova! Deixa eu testar!', 'speech', 2.8);
        return;
      }

      // Priority 5: Organic Personality + Novelty + Natural Saturation Free Will + Rain Awareness
      const isRaining = weather === 'rainy';
      const candidates: Array<{
        key: LeisureActivityKey;
        score: number;
        item?: PlacedFurniture;
        plot?: GardenPlot;
        thought: string;
        isNovel: boolean;
      }> = [];

      const ripeSunflower = gardenPlots.find((p) => p.stage === 3 && p.seed === 'sunflower');
      if (ripeSunflower && !isRaining && pet.boredom > 18) {
        candidates.push({
          key: 'garden',
          plot: ripeSunflower,
          score:
            18 + pet.traits.carinhoso * 0.55 + pet.traits.artistico * 0.4 + pet.boredom * 0.25,
          thought: 'Olha que girassol lindo!',
          isNovel: false,
        });
      }

      const diary = findClosestFurniture(pet, furniture, (f) => f.type === 'diary');
      if (
        diary &&
        pet.mentalEnergy > 10 &&
        pet.diaryCooldown <= 0 &&
        !isDiaryApiBusy &&
        (pet.pendingDiaryEntry || pet.boredom > 36 || (diary.noveltyBoost ?? 0) > 0.45)
      ) {
        const novelty = diary.noveltyBoost ?? 0;
        candidates.push({
          key: 'diary',
          item: diary,
          score:
            16 +
            (pet.pendingDiaryEntry ? 36 : 0) +
            (isRaining ? 12 : 0) +
            pet.traits.filosofo * 0.75 +
            pet.traits.carinhoso * 0.4 +
            pet.boredom * 0.2 +
            novelty * 135,
          thought: novelty > 0.45 ? 'Diário novo! Vou estrear!' : 'Vou anotar meus pensamentos...',
          isNovel: novelty > 0.45,
        });
      }

      const ball = findClosestFurniture(pet, furniture, (f) => f.type === 'ball');
      if (
        ball &&
        !isRaining &&
        pet.ballCooldown <= 0 &&
        (pet.health < 84 || pet.boredom > 32 || (ball.noveltyBoost ?? 0) > 0.45)
      ) {
        const novelty = ball.noveltyBoost ?? 0;
        candidates.push({
          key: 'ball',
          item: ball,
          score:
            20 +
            (100 - pet.health) * 0.9 +
            (100 - pet.traits.preguicoso) * 0.35 +
            pet.traits.trabalhador * 0.25 +
            pet.boredom * 0.35 +
            novelty * 145,
          thought: novelty > 0.45 ? 'Bola nova! Bora chutar!' : 'Vou bater uma bolinha!',
          isNovel: novelty > 0.45,
        });
      }

      const computer = findClosestFurniture(pet, furniture, (f) => f.type === 'computer');
      if (
        computer &&
        pet.computerCooldown <= 0 &&
        !isDiscoveryApiBusy &&
        (pet.boredom > 24 || pet.traits.nerd >= 65 || (computer.noveltyBoost ?? 0) > 0.45)
      ) {
        const novelty = computer.noveltyBoost ?? 0;
        const gamerBonus = pet.traits.nerd >= 65 ? (pet.traits.nerd - 60) * 1.45 : 0;
        candidates.push({
          key: 'computer',
          item: computer,
          score:
            22 +
            (isRaining ? 18 : 0) +
            pet.traits.nerd * 1.15 +
            pet.traits.curioso * 0.55 +
            pet.traits.preguicoso * 0.35 +
            pet.boredom * 0.3 +
            gamerBonus +
            novelty * 145,
          thought: novelty > 0.45 ? 'PC novo!! Quero testar tudo!' : 'Vou dar uma olhada no PC!',
          isNovel: novelty > 0.45,
        });
      }

      const easel = findClosestFurniture(pet, furniture, (f) => f.type === 'easel');
      if (
        easel &&
        pet.mentalEnergy > 10 &&
        pet.paintCooldown <= 0 &&
        !isPaintingApiBusy &&
        (pet.boredom > 34 || (easel.noveltyBoost ?? 0) > 0.45)
      ) {
        const novelty = easel.noveltyBoost ?? 0;
        candidates.push({
          key: 'easel',
          item: easel,
          score:
            20 +
            (isRaining ? 18 : 0) +
            pet.traits.artistico * 1.1 +
            pet.inspiration * 0.4 +
            pet.boredom * 0.35 +
            novelty * 145,
          thought: novelty > 0.45 ? 'Cavalete novo! Vou pintar já!' : 'Deu vontade de desenhar!',
          isNovel: novelty > 0.45,
        });
      }

      const hasUrgentNovelty = candidates.some((c) => c.isNovel);
      const readyToDecide =
        candidates.length > 0 &&
        (hasUrgentNovelty || pet.path.length === 0 || pet.boredom > 46);

      if (readyToDecide) {
        const weighted = candidates.map((cand) => {
          const sat = pet.satiationMap?.[cand.key] ?? 0;
          const isConsecutive = pet.lastUsedActivityType === cand.key;
          const consecPenalty = isConsecutive
            ? Math.min(0.62, (pet.consecutiveUseCount || 1) * 0.22)
            : 0;
          let totalPenalty = Math.min(0.88, sat * 0.65 + consecPenalty);

          // Exception: high Gamer/Nerd pets can stay hooked on the PC naturally
          if (cand.key === 'computer' && pet.traits.nerd >= 65) {
            totalPenalty *= 0.22;
          }

          const adjusted = Math.max(1.5, cand.score * Math.max(0.12, 1 - totalPenalty));
          return {
            cand,
            weight: Math.pow(adjusted, 1.3),
          };
        });

        const totalWeight = weighted.reduce((acc, w) => acc + w.weight, 0);
        let roll = Math.random() * totalWeight;
        let chosen = weighted[0].cand;
        for (const entry of weighted) {
          roll -= entry.weight;
          if (roll <= 0) {
            chosen = entry.cand;
            break;
          }
        }

        if (chosen.plot) {
          recordActivityUse(pet, 'garden');
          pet.targetPlotId = chosen.plot.id;
          pet.path = findPath(pet, { x: chosen.plot.x, y: chosen.plot.y + 38 });
          pet.state = 'WALKING_TO_OBJECT';
          setBubble(pet, chosen.thought, 'thought', 2.6);
          return;
        }
        if (chosen.item) {
          pet.targetFurnitureId = chosen.item.id;
          pet.path = findPath(pet, getApproachPoint(chosen.item));
          pet.state = 'WALKING_TO_OBJECT';
          setBubble(pet, chosen.thought, chosen.isNovel ? 'speech' : 'thought', 2.8);
          return;
        }
      }

      // If raining and pet is outside in the yard, head back inside cozy house!
      if (isRaining && getZoneNameAt(pet.x, pet.y) === 'Quintal' && pet.path.length === 0) {
        const indoorTarget =
          Math.random() < 0.45
            ? INDOOR_WINDOW_SPOTS[Math.floor(Math.random() * INDOOR_WINDOW_SPOTS.length)]
            : getRandomIndoorWalkablePoint();
        pet.path = findPath(pet, indoorTarget);
        setBubble(pet, 'Chuva lá fora! Melhor ficar dentro de casa.', 'thought', 3.0);
        return;
      }

      // Default Wander
      if (pet.path.length > 0) {
        const reached = followPath(pet, dt, 98);
        if (reached) {
          pet.stateTimer = 1.6 + Math.random() * 2.4;
          if (!pet.bubbleText && Math.random() < 0.45) {
            if (pet.grumpyTimer > 0 || pet.affinity < 40) {
              setBubble(pet, 'Hmph... ainda tô chateado com você.', 'speech', 3.0);
            } else if (isRaining) {
              const rainThought =
                WANDER_THOUGHTS_RAIN[Math.floor(Math.random() * WANDER_THOUGHTS_RAIN.length)];
              setBubble(pet, rainThought, 'thought', 3.2);
            } else {
              const zone = getZoneNameAt(pet.x, pet.y);
              const pool =
                timeOfDay === 'night'
                  ? [...WANDER_THOUGHTS_NIGHT, `Adoro ficar aqui no ${zone}.`]
                  : [...WANDER_THOUGHTS_DAY, `Dando uma voltinha por: ${zone}.`];
              setBubble(
                pet,
                pool[Math.floor(Math.random() * pool.length)],
                'thought',
                3.2
              );
            }
          }
        }
      } else {
        pet.vx = 0;
        pet.vy = 0;
        pet.stateTimer -= dt;
        if (pet.stateTimer <= 0) {
          const dest = isRaining
            ? Math.random() < 0.4
              ? INDOOR_WINDOW_SPOTS[Math.floor(Math.random() * INDOOR_WINDOW_SPOTS.length)]
              : getRandomIndoorWalkablePoint()
            : getRandomWalkablePoint();
          pet.path = findPath(pet, dest);
          pet.stateTimer = 2.0 + Math.random() * 2.5;
        }
      }
    }
  }
}

function followPath(pet: PetState, dt: number, speed: number): boolean {
  if (pet.path.length === 0) {
    pet.vx = 0;
    pet.vy = 0;
    return true;
  }

  const target = pet.path[0];
  const dx = target.x - pet.x;
  const dy = target.y - pet.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 6) {
    pet.x = target.x;
    pet.y = target.y;
    pet.path.shift();
    if (pet.path.length === 0) {
      pet.vx = 0;
      pet.vy = 0;
      return true;
    }
    return false;
  }

  const step = Math.min(dist, speed * dt);
  const nx = dx / dist;
  const ny = dy / dist;

  pet.vx = nx * speed;
  pet.vy = ny * speed;
  pet.x += nx * step;
  pet.y += ny * step;
  pet.walkCycle += dt * (speed / 24);

  pet.lookX += (nx - pet.lookX) * Math.min(1, dt * 10);
  pet.lookY += (ny - pet.lookY) * Math.min(1, dt * 10);

  return false;
}
