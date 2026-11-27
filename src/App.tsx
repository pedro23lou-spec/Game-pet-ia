import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ArtGalleryModal } from './components/ArtGalleryModal';
import { ChatDrawer } from './components/ChatDrawer';
import { CompanionCreatorModal } from './components/CompanionCreatorModal';
import { DiaryModal, type DiaryViewPhase } from './components/DiaryModal';
import { InventoryBar } from './components/InventoryBar';
import { PenaltyMinigameModal } from './components/PenaltyMinigameModal';
import { PetRadialMenu } from './components/PetRadialMenu';
import { ShopModal } from './components/ShopModal';
import { TopHud } from './components/TopHud';
import { WorkGateModal } from './components/WorkGateModal';
import type {
  ArtworkEntry,
  ChatMessage,
  DiaryEntry,
  DiscoveryEntry,
  FurnitureType,
  GardenPlot,
  PetAppearance,
  PetState,
  PetTraits,
  PlacedFurniture,
  SeedType,
  TimeOfDay,
  TraitKey,
  Vec2,
  WeatherType,
  WorkGig,
} from './types/game';
import {
  chatWithPet,
  discoverPetKnowledge,
  hasConfiguredApiKey,
  paintPetArtwork,
  summarizePetMemory,
  writePetDiary,
} from './services/geminiService';
import {
  SOCIAL_BATTERY_MAX,
  canRunAutonomousAi,
  consumeSocialBattery,
  markAutonomousAiUsed,
  readSocialBattery,
  type SocialBatteryState,
} from './services/socialBattery';
import {
  renderWorldCanvas,
  type FloatingNotice,
  type HeartParticle,
  type ParticleKind,
} from './world/canvasRenderer';
import {
  canPlaceFurniture,
  DEFAULT_APPEARANCE,
  DEFAULT_FURNITURE,
  DEFAULT_GARDEN_PLOTS,
  findPath,
  FURNITURE_CATALOG,
  getRandomIndoorWalkablePoint,
  getTimeOfDayFromClock,
  isPetSeeingFurniture,
  isPointBlocked,
  SEED_CATALOG,
  WORK_GATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './world/mapData';
import {
  describePetMood,
  pushPetMemory,
  sendPetToWork,
  startPetAffectionWalk,
  stepPetSimulation,
} from './world/petBrain';
import { soundFx } from './world/soundFx';

const STORAGE_KEYS = {
  PET: 'cantinho_pet_state_v1',
  FURNITURE: 'cantinho_pet_furniture_v1',
  ARTWORKS: 'cantinho_pet_artworks_v1',
  DISCOVERIES: 'cantinho_pet_discoveries_v1',
  DIARY: 'cantinho_pet_diary_v1',
  CHAT: 'cantinho_pet_chat_v1',
  COINS: 'cantinho_pet_coins_v1',
  GARDEN: 'cantinho_pet_garden_v1',
  INITIALIZED: 'cantinho_pet_initialized_v1',
  LAST_SEEN: 'lastSeenTimestamp',
  LAST_PET_TIME: 'lastPetTime',
  LAST_PRAISE_TIME: 'lastPraiseTime',
};

const SOCIAL_COOLDOWN_MS = 5 * 60 * 1000;
const PRAISE_GRUMPY_COOLDOWN_MS = 2 * 60 * 1000;

function loadStoredTimestamp(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function formatCountdownClock(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSec % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

const VALID_FURNITURE_TYPES = new Set<FurnitureType>([
  'fridge',
  'mat',
  'bed',
  'easel',
  'computer',
  'diary',
  'ball',
]);

const DEFAULT_TRAITS: PetTraits = {
  curioso: 22,
  nerd: 14,
  filosofo: 16,
  artistico: 24,
  carinhoso: 28,
  trabalhador: 15,
  preguicoso: 15,
};

function createDefaultPet(
  overrides?: Partial<Pick<PetState, 'name' | 'appearance' | 'traits' | 'bubbleText'>>
): PetState {
  return {
    name: overrides?.name ?? 'Pipoca',
    appearance: overrides?.appearance ? { ...overrides.appearance } : { ...DEFAULT_APPEARANCE },
    x: 410,
    y: 675,
    vx: 0,
    vy: 0,
    lookX: 1,
    lookY: 0,
    hunger: 74,
    energy: 82,
    mentalEnergy: 90,
    health: 86,
    inspiration: 45,
    boredom: 22,
    affinity: 52,
    traits: overrides?.traits ? { ...overrides.traits } : { ...DEFAULT_TRAITS },
    workCount: 0,
    activeComputerActivity: null,
    activeWorkReward: 0,
    activeWorkLabel: null,
    targetPlotId: null,
    grumpyTimer: 0,
    happyEyesTimer: 0,
    interactionPauseTimer: 0,
    affectionSeekCooldown: 0,
    longTermMemory: '',
    recentEvents: [],
    lastActiveAt: Date.now(),
    state: 'WANDERING',
    stateTimer: 1.5,
    targetFurnitureId: null,
    path: [],
    bubbleText: overrides?.bubbleText ?? 'Oi! Que bom te ver aqui!',
    bubbleKind: 'speech',
    bubbleTimer: 3.8,
    isLookingAtScreen: false,
    blinkTimer: 2.5,
    isBlinking: false,
    walkCycle: 0,
    paintCooldown: 0,
    computerCooldown: 0,
    diaryCooldown: 0,
    ballCooldown: 0,
    workCooldown: 0,
    pendingDiaryEntry: false,
    secondsWithoutAttention: 0,
    lastUsedActivityType: null,
    consecutiveUseCount: 0,
    satiationMap: {},
  };
}

function sanitizeStoredAppearance(raw: unknown): PetAppearance {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_APPEARANCE };
  const obj = raw as Partial<PetAppearance>;
  return {
    primaryColor:
      typeof obj.primaryColor === 'string' ? obj.primaryColor : DEFAULT_APPEARANCE.primaryColor,
    secondaryColor:
      typeof obj.secondaryColor === 'string'
        ? obj.secondaryColor
        : DEFAULT_APPEARANCE.secondaryColor,
    accentColor:
      typeof obj.accentColor === 'string' ? obj.accentColor : DEFAULT_APPEARANCE.accentColor,
    bodyShape: obj.bodyShape ?? DEFAULT_APPEARANCE.bodyShape,
    earStyle: obj.earStyle ?? DEFAULT_APPEARANCE.earStyle,
    eyeStyle: obj.eyeStyle ?? DEFAULT_APPEARANCE.eyeStyle,
    accessory: obj.accessory ?? DEFAULT_APPEARANCE.accessory,
    descriptionPrompt:
      typeof obj.descriptionPrompt === 'string'
        ? obj.descriptionPrompt
        : DEFAULT_APPEARANCE.descriptionPrompt,
  };
}

function loadStoredPet(): PetState {
  const fallback = createDefaultPet();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PET);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PetState>;
    const x =
      typeof parsed.x === 'number' && !isPointBlocked(parsed.x, parsed.y ?? fallback.y, 18)
        ? parsed.x
        : fallback.x;
    const y =
      typeof parsed.y === 'number' && !isPointBlocked(x, parsed.y, 18)
        ? parsed.y
        : fallback.y;

    const traits: PetTraits = { ...DEFAULT_TRAITS };
    if (parsed.traits && typeof parsed.traits === 'object') {
      for (const key of Object.keys(DEFAULT_TRAITS) as TraitKey[]) {
        const val = parsed.traits[key];
        if (typeof val === 'number' && !Number.isNaN(val)) {
          traits[key] = Math.max(0, Math.min(100, val));
        }
      }
    }

    return {
      ...fallback,
      name:
        typeof parsed.name === 'string' && parsed.name.trim().length > 0
          ? parsed.name.trim().slice(0, 24)
          : fallback.name,
      appearance: sanitizeStoredAppearance(parsed.appearance),
      x,
      y,
      hunger:
        typeof parsed.hunger === 'number'
          ? Math.max(0, Math.min(100, parsed.hunger))
          : fallback.hunger,
      energy:
        typeof parsed.energy === 'number'
          ? Math.max(0, Math.min(100, parsed.energy))
          : fallback.energy,
      mentalEnergy:
        typeof parsed.mentalEnergy === 'number'
          ? Math.max(0, Math.min(100, parsed.mentalEnergy))
          : fallback.mentalEnergy,
      health:
        typeof parsed.health === 'number'
          ? Math.max(0, Math.min(100, parsed.health))
          : fallback.health,
      inspiration:
        typeof parsed.inspiration === 'number'
          ? Math.max(0, Math.min(100, parsed.inspiration))
          : fallback.inspiration,
      boredom:
        typeof parsed.boredom === 'number'
          ? Math.max(0, Math.min(100, parsed.boredom))
          : fallback.boredom,
      affinity:
        typeof parsed.affinity === 'number'
          ? Math.max(0, Math.min(100, parsed.affinity))
          : fallback.affinity,
      workCount:
        typeof parsed.workCount === 'number' && parsed.workCount >= 0
          ? Math.floor(parsed.workCount)
          : 0,
      traits,
      grumpyTimer:
        typeof parsed.grumpyTimer === 'number' && parsed.grumpyTimer > 0
          ? Math.min(60, parsed.grumpyTimer)
          : 0,
      happyEyesTimer: 0,
      interactionPauseTimer: 0,
      affectionSeekCooldown: 0,
      secondsWithoutAttention:
        typeof parsed.secondsWithoutAttention === 'number' && parsed.secondsWithoutAttention >= 0
          ? parsed.secondsWithoutAttention
          : 0,
      longTermMemory:
        typeof parsed.longTermMemory === 'string'
          ? parsed.longTermMemory.trim().slice(0, 400)
          : '',
      recentEvents: Array.isArray(parsed.recentEvents)
        ? parsed.recentEvents.filter((s): s is string => typeof s === 'string').slice(0, 8)
        : [],
      lastActiveAt:
        typeof parsed.lastActiveAt === 'number' && Number.isFinite(parsed.lastActiveAt)
          ? parsed.lastActiveAt
          : undefined,
    };
  } catch {
    return fallback;
  }
}

function loadStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function loadStoredCoins(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COINS);
    if (!raw) return 100;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 100;
  } catch {
    return 100;
  }
}

function loadStoredGardenPlots(): GardenPlot[] {
  const stored = loadStoredArray<GardenPlot>(STORAGE_KEYS.GARDEN, DEFAULT_GARDEN_PLOTS);
  if (stored.length !== DEFAULT_GARDEN_PLOTS.length) {
    return DEFAULT_GARDEN_PLOTS.map((p) => ({ ...p }));
  }
  return DEFAULT_GARDEN_PLOTS.map((base, idx) => {
    const item = stored[idx];
    if (!item || typeof item !== 'object') return { ...base };
    const validSeed =
      item.seed === 'carrot' || item.seed === 'tomato' || item.seed === 'sunflower'
        ? item.seed
        : null;
    const stage: 0 | 1 | 2 | 3 =
      item.stage === 1 || item.stage === 2 || item.stage === 3 ? item.stage : 0;
    return {
      ...base,
      seed: validSeed,
      stage: validSeed ? stage : 0,
      watered: Boolean(validSeed && item.watered && stage < 3),
      growthProgress:
        validSeed && typeof item.growthProgress === 'number'
          ? Math.max(0, Math.min(1, item.growthProgress))
          : 0,
    };
  });
}

function hasExistingSave(): boolean {
  try {
    return Boolean(
      localStorage.getItem(STORAGE_KEYS.INITIALIZED) || localStorage.getItem(STORAGE_KEYS.PET)
    );
  } catch {
    return false;
  }
}

function formatClockText(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const petRef = useRef<PetState>(loadStoredPet());
  const furnitureRef = useRef<PlacedFurniture[]>(
    loadStoredArray<PlacedFurniture>(STORAGE_KEYS.FURNITURE, DEFAULT_FURNITURE).filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        VALID_FURNITURE_TYPES.has(item.type)
    )
  );
  const gardenPlotsRef = useRef<GardenPlot[]>(loadStoredGardenPlots());
  const cameraRef = useRef<{ x: number; y: number; zoom: number; follow: boolean }>({
    x: petRef.current.x,
    y: petRef.current.y,
    zoom: 1,
    follow: true,
  });
  const noticesRef = useRef<FloatingNotice[]>([]);
  const heartsRef = useRef<HeartParticle[]>([]);

  const paintInFlightRef = useRef(false);
  const discoveryInFlightRef = useRef(false);
  const diaryInFlightRef = useRef(false);
  const memoryInFlightRef = useRef(false);
  const sentChatCountRef = useRef<number | null>(null);
  const lastPetPatAtRef = useRef(0);
  const lastPondSplashAtRef = useRef(0);
  const lastSpokenBubbleRef = useRef<string | null>(petRef.current.bubbleText);

  const timeScaleRef = useRef<1 | 2 | 5>(1);
  const timeOfDayRef = useRef<TimeOfDay>(getTimeOfDayFromClock());
  const weatherRef = useRef<WeatherType>('sunny');
  const placingTypeRef = useRef<FurnitureType | null>(null);
  const movingFurnitureIdRef = useRef<string | null>(null);
  const activeSeedRef = useRef<SeedType | null>(null);
  const placingPaidPriceRef = useRef<number>(0);
  const seedPaidPriceRef = useRef<number>(0);

  const hoverWorldRef = useRef<Vec2 | null>(null);
  const hoveredFurnitureIdRef = useRef<string | null>(null);
  const hoveredPlotIdRef = useRef<string | null>(null);
  const hoveredGateRef = useRef<boolean>(false);
  const selectedFurnitureIdRef = useRef<string | null>(null);

  const petStrokeRef = useRef<{
    active: boolean;
    startScreenX: number;
    startScreenY: number;
    lastX: number;
    lastY: number;
    strokeAccum: number;
    didStroke: boolean;
    lastHeartAt: number;
  }>({
    active: false,
    startScreenX: 0,
    startScreenY: 0,
    lastX: 0,
    lastY: 0,
    strokeAccum: 0,
    didStroke: false,
    lastHeartAt: 0,
  });

  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startScreenX: number;
    startScreenY: number;
    startCamX: number;
    startCamY: number;
  }>({
    active: false,
    moved: false,
    startScreenX: 0,
    startScreenY: 0,
    startCamX: 0,
    startCamY: 0,
  });

  // React UI states
  const [hudStats, setHudStats] = useState({
    name: petRef.current.name,
    hunger: petRef.current.hunger,
    energy: petRef.current.energy,
    mentalEnergy: petRef.current.mentalEnergy,
    health: petRef.current.health,
    inspiration: petRef.current.inspiration,
    affinity: petRef.current.affinity,
    traits: petRef.current.traits,
    mood: describePetMood(petRef.current),
    workCount: petRef.current.workCount,
    state: petRef.current.state,
  });

  const [lastPetTime, setLastPetTime] = useState<number>(() =>
    loadStoredTimestamp(STORAGE_KEYS.LAST_PET_TIME)
  );
  const lastPetTimeRef = useRef<number>(lastPetTime);
  lastPetTimeRef.current = lastPetTime;

  const [lastPraiseTime, setLastPraiseTime] = useState<number>(() =>
    loadStoredTimestamp(STORAGE_KEYS.LAST_PRAISE_TIME)
  );
  const lastPraiseTimeRef = useRef<number>(lastPraiseTime);
  lastPraiseTimeRef.current = lastPraiseTime;

  const [coins, setCoins] = useState<number>(() => loadStoredCoins());
  const coinsRef = useRef<number>(coins);
  coinsRef.current = coins;

  const [furniture, setFurniture] = useState<PlacedFurniture[]>(furnitureRef.current);
  const [gardenPlots, setGardenPlots] = useState<GardenPlot[]>(gardenPlotsRef.current);
  const [artworks, setArtworks] = useState<ArtworkEntry[]>(() =>
    loadStoredArray<ArtworkEntry>(STORAGE_KEYS.ARTWORKS, [])
  );
  const [discoveries, setDiscoveries] = useState<DiscoveryEntry[]>(() =>
    loadStoredArray<DiscoveryEntry>(STORAGE_KEYS.DISCOVERIES, [])
  );
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() =>
    loadStoredArray<DiaryEntry>(STORAGE_KEYS.DIARY, [])
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    loadStoredArray<ChatMessage>(STORAGE_KEYS.CHAT, [])
  );

  const [creatorState, setCreatorState] = useState<{ open: boolean; canCancel: boolean }>(() => ({
    open: !hasExistingSave(),
    canCancel: hasExistingSave(),
  }));

  const [apiKeyModalState, setApiKeyModalState] = useState<{ open: boolean; canClose: boolean }>(
    () => ({
      open: hasExistingSave() && !hasConfiguredApiKey(),
      canClose: hasConfiguredApiKey() || !hasExistingSave(),
    })
  );

  const [hasUnreadGallery, setHasUnreadGallery] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<'art' | 'discoveries'>('art');

  const [shopOpen, setShopOpen] = useState(false);
  const [workGateOpen, setWorkGateOpen] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatActiveRef = useRef(false);
  chatActiveRef.current = chatOpen || chatSending;

  const [diaryModal, setDiaryModal] = useState<{
    open: boolean;
    furnitureId: string | null;
    phase: DiaryViewPhase;
  }>({ open: false, furnitureId: null, phase: 'choice' });

  const [placingType, setPlacingType] = useState<FurnitureType | null>(null);
  const [movingFurnitureId, setMovingFurnitureId] = useState<string | null>(null);
  const [activeSeedToPlant, setActiveSeedToPlant] = useState<SeedType | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);

  const [cameraFollowsPet, setCameraFollowsPet] = useState(true);
  const [timeScale, setTimeScale] = useState<1 | 2 | 5>(1);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(timeOfDayRef.current);
  const [weather, setWeather] = useState<WeatherType>('sunny');
  const [clockText, setClockText] = useState<string>(() => formatClockText(new Date()));
  const [petRadialMenu, setPetRadialMenu] = useState<{
    open: boolean;
    screenX: number;
    screenY: number;
    openedAtTimestamp: number;
  }>({ open: false, screenX: 0, screenY: 0, openedAtTimestamp: 0 });
  const petRadialMenuRef = useRef(petRadialMenu);
  petRadialMenuRef.current = petRadialMenu;
  const [isMuted, setIsMuted] = useState(false);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [apiErrorBanner, setApiErrorBanner] = useState<string | null>(null);
  const [socialBattery, setSocialBattery] = useState<SocialBatteryState>(() =>
    readSocialBattery()
  );
  const [offlineNotice, setOfflineNotice] = useState<{
    hoursAway: number;
    affinityLoss: number;
    petName: string;
    summary: string;
  } | null>(null);

  const showSafeApiBanner = useCallback((msg: string | null) => {
    setApiErrorBanner(msg || null);
  }, []);

  useEffect(() => {
    const syncBattery = () => {
      setSocialBattery(readSocialBattery());
    };
    syncBattery();
    const timer = window.setInterval(syncBattery, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleConsumeSocialBattery = useCallback((cost: number): boolean => {
    const next = consumeSocialBattery(cost);
    setSocialBattery({
      energy: next.energy,
      lastRechargeAt: next.lastRechargeAt,
      nextRechargeMs: next.nextRechargeMs,
    });
    return next.ok;
  }, []);

  // Ensure API Key modal opens automatically in-game if no user_gemini_api_key is saved in localStorage
  useEffect(() => {
    if (hasExistingSave() && !hasConfiguredApiKey()) {
      setApiKeyModalState({ open: true, canClose: false });
    }
  }, []);

  const artworksRef = useRef<ArtworkEntry[]>(artworks);
  artworksRef.current = artworks;
  const discoveriesRef = useRef<DiscoveryEntry[]>(discoveries);
  discoveriesRef.current = discoveries;
  const diaryModalRef = useRef(diaryModal);
  diaryModalRef.current = diaryModal;

  placingTypeRef.current = placingType;
  movingFurnitureIdRef.current = movingFurnitureId;
  activeSeedRef.current = activeSeedToPlant;
  selectedFurnitureIdRef.current = selectedFurnitureId;
  timeScaleRef.current = timeScale;

  // LocalStorage persistence effects
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FURNITURE, JSON.stringify(furniture));
    } catch {
      // Ignore quota errors
    }
  }, [furniture]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GARDEN, JSON.stringify(gardenPlots));
    } catch {
      // Ignore quota errors
    }
  }, [gardenPlots]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COINS, JSON.stringify(coins));
    } catch {
      // Ignore quota errors
    }
  }, [coins]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ARTWORKS, JSON.stringify(artworks));
    } catch {
      // Ignore quota errors
    }
  }, [artworks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DISCOVERIES, JSON.stringify(discoveries));
    } catch {
      // Ignore quota errors
    }
  }, [discoveries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(diaryEntries));
    } catch {
      // Ignore quota errors
    }
  }, [diaryEntries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatMessages.slice(-40)));
    } catch {
      // Ignore quota errors
    }
  }, [chatMessages]);

  // Unlock Web Audio API on first gesture and pause inactivity affinity decay while player is active
  useEffect(() => {
    const markPlayerActive = () => {
      soundFx.unlock();
      petRef.current.secondsWithoutAttention = 0;
    };
    window.addEventListener('pointerdown', markPlayerActive, { passive: true });
    window.addEventListener('keydown', markPlayerActive, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', markPlayerActive);
      window.removeEventListener('keydown', markPlayerActive);
    };
  }, []);

  // Real-time lighting clock sync + natural weather progression + welcome-back initiative
  useEffect(() => {
    soundFx.setTimeOfDay(timeOfDayRef.current);
    const syncClock = () => {
      const now = new Date();
      const nextTod = getTimeOfDayFromClock(now);
      timeOfDayRef.current = nextTod;
      soundFx.setTimeOfDay(nextTod);
      setTimeOfDay(nextTod);
      setClockText(formatClockText(now));
    };
    const clockTimer = window.setInterval(syncClock, 5000);

    const weatherTimer = window.setInterval(() => {
      const cur = weatherRef.current;
      let next: WeatherType = cur;
      const r = Math.random();
      if (cur === 'sunny') {
        if (r < 0.45) next = 'cloudy';
      } else if (cur === 'cloudy') {
        if (r < 0.4) next = 'rainy';
        else if (r < 0.8) next = 'sunny';
      } else {
        if (r < 0.55) next = 'cloudy';
        else if (r < 0.72) next = 'sunny';
      }
      if (next !== cur) {
        weatherRef.current = next;
        setWeather(next);
      }
    }, 85000);

    // Check offline elapsed time via lastSeenTimestamp (-5 Affinity per full hour away)
    let welcomeTimer = 0;
    if (hasExistingSave()) {
      let prevSeenMs: number | undefined;
      try {
        const rawSeen = localStorage.getItem(STORAGE_KEYS.LAST_SEEN);
        if (rawSeen) {
          const parsedSeen = Number(rawSeen);
          if (Number.isFinite(parsedSeen) && parsedSeen > 0) {
            prevSeenMs = parsedSeen;
          }
        }
      } catch {
        // Ignore storage read errors
      }
      if (!prevSeenMs && petRef.current.lastActiveAt) {
        prevSeenMs = petRef.current.lastActiveAt;
      }

      if (prevSeenMs) {
        const elapsedMs = Math.max(0, Date.now() - prevSeenMs);

        const fullHours = Math.floor(elapsedMs / (1000 * 60 * 60));
        if (fullHours >= 1) {
          const prevAff = petRef.current.affinity;
          const nextAff = Math.max(0, prevAff - fullHours * 5);
          const actualLoss = Math.round(prevAff - nextAff);
          petRef.current.affinity = nextAff;
          if (actualLoss > 0) {
            pushPetMemory(
              petRef.current,
              `Você ficou ${fullHours}h fora e eu senti muito a sua falta (-${actualLoss} Afinidade).`
            );
          }
          setOfflineNotice({
            hoursAway: fullHours,
            affinityLoss: actualLoss,
            petName: petRef.current.name,
            summary:
              fullHours >= 4
                ? `${petRef.current.name} passou ${fullHours}h esperando você voltar, tirou uns cochilos e ficou olhando pela janela.`
                : `${petRef.current.name} sentiu sua falta durante ${fullHours}h fora e ficou te esperando na sala.`,
          });
        }

        if (elapsedMs > 90_000) {
          welcomeTimer = window.setTimeout(() => {
            if (petRef.current.state !== 'WORKING') {
              startPetAffectionWalk(petRef.current, 'welcome_back');
            }
          }, 750);
        }
      }

      try {
        localStorage.setItem(STORAGE_KEYS.LAST_SEEN, String(Date.now()));
      } catch {
        // Ignore storage write errors
      }
    }

    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(weatherTimer);
      if (welcomeTimer) window.clearTimeout(welcomeTimer);
    };
  }, []);

  const addFloatingNotice = useCallback((x: number, y: number, text: string, color = '#047857') => {
    noticesRef.current.push({
      id: `${Date.now()}-${Math.random()}`,
      x,
      y,
      text,
      color,
      timer: 1.5,
      maxTimer: 1.5,
    });
  }, []);

  const spawnParticleBurst = useCallback(
    (x: number, y: number, kind: ParticleKind = 'heart', count = 3) => {
      for (let i = 0; i < count; i++) {
        let vx = (Math.random() - 0.5) * 24;
        let vy = -(24 + Math.random() * 22);
        let size = 7 + Math.random() * 4;
        let maxTimer = 1.15;

        if (kind === 'star') {
          vx = (Math.random() - 0.5) * 68;
          vy = -(30 + Math.random() * 30);
          size = 6.5 + Math.random() * 4;
          maxTimer = 1.1;
        } else if (kind === 'water') {
          vx = (Math.random() - 0.5) * 84;
          vy = -(45 + Math.random() * 42);
          size = 4.5 + Math.random() * 3;
          maxTimer = 0.72;
        } else if (kind === 'dust') {
          vx = (Math.random() - 0.5) * 30;
          vy = -(8 + Math.random() * 12);
          size = 4.5 + Math.random() * 3;
          maxTimer = 0.52;
        }

        heartsRef.current.push({
          id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: x + (Math.random() - 0.5) * (kind === 'dust' ? 12 : 26),
          y: y + (Math.random() - 0.5) * (kind === 'dust' ? 6 : 14),
          vx,
          vy,
          size,
          timer: maxTimer,
          maxTimer,
          kind,
        });
      }
    },
    []
  );

  const spawnHeartBurst = useCallback(
    (x: number, y: number, count = 3) => {
      spawnParticleBurst(x, y, 'heart', count);
    },
    [spawnParticleBurst]
  );

  const waterPlotsFromRain = useCallback(() => {
    const wateredPlots: GardenPlot[] = [];
    const next = gardenPlotsRef.current.map((p) => {
      if (p.seed && p.stage < 3 && !p.watered) {
        wateredPlots.push(p);
        return { ...p, watered: true };
      }
      return p;
    });
    if (wateredPlots.length > 0) {
      gardenPlotsRef.current = next;
      setGardenPlots(next);
      soundFx.playWater();
      for (const wp of wateredPlots) {
        spawnParticleBurst(wp.x, wp.y - 6, 'water', 4);
      }
      addFloatingNotice(
        gardenPlotsRef.current[1]?.x ?? 1090,
        (gardenPlotsRef.current[1]?.y ?? 760) - 34,
        'Chuva regou a horta!',
        '#0284C7'
      );
    }
  }, [addFloatingNotice, spawnParticleBurst]);

  useEffect(() => {
    if (weather === 'rainy') {
      waterPlotsFromRain();
    }
  }, [weather, waterPlotsFromRain]);

  const handleCycleWeather = useCallback(() => {
    soundFx.unlock();
    const order: WeatherType[] = ['sunny', 'cloudy', 'rainy'];
    const next = order[(order.indexOf(weatherRef.current) + 1) % order.length];
    weatherRef.current = next;
    setWeather(next);
    const label =
      next === 'sunny' ? 'Ensolarado 🌤️' : next === 'cloudy' ? 'Nublado ☁️' : 'Chuvoso 🌧️';
    addFloatingNotice(petRef.current.x, petRef.current.y - 38, label, '#0284C7');
  }, [addFloatingNotice]);

  const cancelPlacementOrSeed = useCallback(() => {
    if (placingPaidPriceRef.current > 0) {
      const refund = placingPaidPriceRef.current;
      placingPaidPriceRef.current = 0;
      setCoins((c) => {
        const next = c + refund;
        coinsRef.current = next;
        return next;
      });
      addFloatingNotice(petRef.current.x, petRef.current.y - 30, `+${refund} reembolso`, '#D97706');
    }
    if (seedPaidPriceRef.current > 0) {
      const refund = seedPaidPriceRef.current;
      seedPaidPriceRef.current = 0;
      setCoins((c) => {
        const next = c + refund;
        coinsRef.current = next;
        return next;
      });
      addFloatingNotice(petRef.current.x, petRef.current.y - 30, `+${refund} reembolso`, '#D97706');
    }
    setPlacingType(null);
    setMovingFurnitureId(null);
    setActiveSeedToPlant(null);
  }, [addFloatingNotice]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelPlacementOrSeed();
        setSelectedFurnitureId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelPlacementOrSeed]);

  // Trigger Flagra if caught sneaking at diary
  const triggerDiaryCaught = useCallback(() => {
    const pet = petRef.current;
    pet.affinity = Math.max(0, pet.affinity - 12);
    pet.grumpyTimer = 20;
    pet.isLookingAtScreen = true;
    pet.bubbleText = 'Ei!! Isso é privado!';
    pet.bubbleKind = 'speech';
    pet.bubbleTimer = 4.8;
    pet.pendingDiaryEntry = true;
    pushPetMemory(pet, 'Peguei o humano tentando ler meu diário escondido!');
    soundFx.playCaught();
    setDiaryModal((prev) => ({ ...prev, phase: 'caught' }));
  }, []);

  // 1. Gemini Painting Handler (45-min autonomous AI cooldown; silent resilience on background failure)
  const handleRequestArtwork = useCallback(
    async (petSnapshot: PetState) => {
      if (
        paintInFlightRef.current ||
        chatActiveRef.current ||
        !hasConfiguredApiKey() ||
        !canRunAutonomousAi()
      ) {
        const pet = petRef.current;
        if (pet.state === 'PAINTING') {
          pet.state = 'WANDERING';
          pet.targetFurnitureId = null;
          pet.paintCooldown = 90;
        }
        return;
      }
      paintInFlightRef.current = true;
      markAutonomousAiUsed();

      try {
        const mood = describePetMood(petSnapshot);
        const nearbyObjects = Array.from(
          new Set(furnitureRef.current.map((item) => FURNITURE_CATALOG[item.type].shortName))
        );
        const previousTitles = artworksRef.current.slice(0, 6).map((a) => a.title);

        const res = await paintPetArtwork({
          petName: petSnapshot.name,
          mood,
          timeOfDay: timeOfDayRef.current,
          hunger: petSnapshot.hunger,
          energy: petSnapshot.energy,
          inspiration: petSnapshot.inspiration,
          nearbyObjects,
          previousTitles,
        });

        if (!res.ok || !res.data.svg || !res.data.title || !res.data.explanation) {
          const pet = petRef.current;
          pet.state = 'WANDERING';
          pet.targetFurnitureId = null;
          if (!res.ok && res.code === 'NO_API_KEY') {
            pet.paintCooldown = 90;
            setApiKeyModalState({ open: true, canClose: true });
          } else if (!res.ok && res.code === 'INVALID_API_KEY') {
            pet.paintCooldown = 180;
            showSafeApiBanner(res.error);
          } else {
            pet.paintCooldown = 180;
          }
          pet.bubbleText = 'Fiquei pensando nas cores e vou tentar depois...';
          pet.bubbleKind = 'thought';
          pet.bubbleTimer = 3.2;
          return;
        }

        const newEntry: ArtworkEntry = {
          id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: res.data.title,
          explanation: res.data.explanation,
          svg: res.data.svg,
          mood,
          timeOfDay: timeOfDayRef.current,
          createdAt: Date.now(),
        };

        setArtworks((prev) => [newEntry, ...prev]);
        setGalleryTab('art');
        setHasUnreadGallery(true);
        setApiErrorBanner(null);
        soundFx.playArtworkReady();

        const pet = petRef.current;
        pet.traits.artistico = Math.min(100, pet.traits.artistico + 3);
        pushPetMemory(pet, `Pintei o quadro "${res.data.title}".`);
        pet.state = 'CALLING_PLAYER';
        pet.stateTimer = 5.0;
        pet.targetFurnitureId = null;
        pet.paintCooldown = 120;
        pet.boredom = 0;
        pet.inspiration = 55;
        pet.isLookingAtScreen = true;
        pet.bubbleText = 'Terminei um desenho! Vem ver!';
        pet.bubbleKind = 'speech';
        pet.bubbleTimer = 5.2;
      } finally {
        paintInFlightRef.current = false;
      }
    },
    [showSafeApiBanner]
  );

  // 2. Gemini Internet Discovery Handler (45-min autonomous AI cooldown; silent resilience)
  const handleRequestDiscovery = useCallback(
    async (petSnapshot: PetState) => {
      if (
        discoveryInFlightRef.current ||
        chatActiveRef.current ||
        !hasConfiguredApiKey() ||
        !canRunAutonomousAi()
      ) {
        return;
      }
      discoveryInFlightRef.current = true;
      markAutonomousAiUsed();

      try {
        const mood = describePetMood(petSnapshot);
        const previousTopics = discoveriesRef.current.slice(0, 8).map((d) => d.topic);

        const res = await discoverPetKnowledge({
          petName: petSnapshot.name,
          mood,
          traits: petSnapshot.traits,
          previousTopics,
        });

        if (!res.ok || !res.data.topic || !res.data.learned) {
          const pet = petRef.current;
          if (!res.ok && res.code === 'NO_API_KEY') {
            pet.computerCooldown = 90;
            setApiKeyModalState({ open: true, canClose: true });
          } else if (!res.ok && res.code === 'INVALID_API_KEY') {
            pet.computerCooldown = 180;
            showSafeApiBanner(res.error);
          } else {
            pet.computerCooldown = 90;
            pet.activeComputerActivity = null;
            pet.state = 'WANDERING';
            pet.targetFurnitureId = null;
            pet.bubbleText = 'Vou descansar os olhos e pesquisar depois...';
            pet.bubbleKind = 'thought';
            pet.bubbleTimer = 3.0;
          }
          return;
        }

        const traitKey: TraitKey = res.data.traitKey ?? 'curioso';
        const traitDelta = res.data.traitDelta ?? 3;

        const newDisc: DiscoveryEntry = {
          id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          topic: res.data.topic,
          learned: res.data.learned,
          traitKey,
          traitDelta,
          mood,
          createdAt: Date.now(),
        };

        setDiscoveries((prev) => [newDisc, ...prev]);
        setGalleryTab('discoveries');
        setHasUnreadGallery(true);
        setApiErrorBanner(null);
        soundFx.playDiscovery();

        const pet = petRef.current;
        pet.traits[traitKey] = Math.min(100, pet.traits[traitKey] + traitDelta);
        pet.pendingDiaryEntry = true;
        pushPetMemory(pet, `Pesquisei na internet sobre "${res.data.topic}".`);
        pet.state = 'CALLING_PLAYER';
        pet.stateTimer = 4.6;
        pet.targetFurnitureId = null;
        pet.computerCooldown = 70;
        pet.isLookingAtScreen = true;
        pet.bubbleText = 'Ei! Olha o que eu descobri na internet!';
        pet.bubbleKind = 'speech';
        pet.bubbleTimer = 5.0;
      } finally {
        discoveryInFlightRef.current = false;
      }
    },
    [showSafeApiBanner]
  );

  // 3. Gemini Secret Diary Entry Handler (45-min autonomous AI cooldown; silent resilience)
  const handleRequestDiary = useCallback(
    async (petSnapshot: PetState) => {
      if (
        diaryInFlightRef.current ||
        chatActiveRef.current ||
        !hasConfiguredApiKey() ||
        !canRunAutonomousAi()
      ) {
        const pet = petRef.current;
        if (pet.state === 'WRITING_DIARY') {
          pet.state = 'WANDERING';
          pet.targetFurnitureId = null;
          pet.diaryCooldown = 120;
        }
        return;
      }
      diaryInFlightRef.current = true;
      markAutonomousAiUsed();

      try {
        const mood = describePetMood(petSnapshot);
        const lastArt = artworksRef.current[0]?.title ?? '';
        const lastDisc = discoveriesRef.current[0]?.topic ?? '';

        const res = await writePetDiary({
          petName: petSnapshot.name,
          mood,
          affinity: petSnapshot.affinity,
          hunger: petSnapshot.hunger,
          energy: petSnapshot.energy,
          health: petSnapshot.health,
          traits: petSnapshot.traits,
          timeOfDay: timeOfDayRef.current,
          weather: weatherRef.current,
          recentEvents: petSnapshot.recentEvents,
          lastArtwork: lastArt,
          lastDiscovery: lastDisc,
        });

        if (!res.ok || !res.data.title || !res.data.content) {
          const pet = petRef.current;
          if (!res.ok && res.code === 'NO_API_KEY') {
            pet.diaryCooldown = 90;
            setApiKeyModalState({ open: true, canClose: true });
          } else if (!res.ok && res.code === 'INVALID_API_KEY') {
            pet.diaryCooldown = 180;
            showSafeApiBanner(res.error);
          } else {
            pet.diaryCooldown = 180;
          }
          return;
        }

        const entry: DiaryEntry = {
          id: `diary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: res.data.title,
          content: res.data.content,
          mood,
          affinityAtTime: Math.round(petSnapshot.affinity),
          createdAt: Date.now(),
        };

        setDiaryEntries((prev) => [entry, ...prev]);
        setApiErrorBanner(null);
      } finally {
        diaryInFlightRef.current = false;
      }
    },
    [showSafeApiBanner]
  );

  const persistPetSnapshot = useCallback((p: PetState) => {
    const now = Date.now();
    try {
      localStorage.setItem(
        STORAGE_KEYS.PET,
        JSON.stringify({
          name: p.name,
          appearance: p.appearance,
          x: p.x,
          y: p.y,
          hunger: p.hunger,
          energy: p.energy,
          mentalEnergy: p.mentalEnergy,
          health: p.health,
          inspiration: p.inspiration,
          boredom: p.boredom,
          affinity: p.affinity,
          workCount: p.workCount,
          grumpyTimer: p.grumpyTimer,
          secondsWithoutAttention: p.secondsWithoutAttention,
          traits: p.traits,
          longTermMemory: p.longTermMemory,
          recentEvents: p.recentEvents,
          lastActiveAt: now,
        })
      );
      if (localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
        localStorage.setItem(STORAGE_KEYS.LAST_SEEN, String(now));
      }
    } catch {
      // Ignore quota issues
    }
  }, []);

  useEffect(() => {
    const saveOnExit = () => {
      persistPetSnapshot(petRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveOnExit();
      } else if (document.visibilityState === 'visible') {
        soundFx.resumeIfUnlocked();
      }
    };
    window.addEventListener('beforeunload', saveOnExit);
    window.addEventListener('pagehide', saveOnExit);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', saveOnExit);
      window.removeEventListener('pagehide', saveOnExit);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persistPetSnapshot]);

  const runBackgroundMemoryUpdate = useCallback(
    async (recentMessages: ChatMessage[]) => {
      if (memoryInFlightRef.current) return;
      memoryInFlightRef.current = true;
      try {
        const pet = petRef.current;
        const res = await summarizePetMemory({
          petName: pet.name,
          currentMemory: pet.longTermMemory,
          recentMessages: recentMessages.slice(-8),
          recentEvents: pet.recentEvents.slice(0, 6),
        });
        if (res.ok && typeof res.data.longTermMemory === 'string') {
          const updated = res.data.longTermMemory.trim().slice(0, 400);
          if (updated) {
            petRef.current.longTermMemory = updated;
            persistPetSnapshot(petRef.current);
          }
        }
      } catch {
        // Silent background failure
      } finally {
        memoryInFlightRef.current = false;
      }
    },
    [persistPetSnapshot]
  );

  // 4. Direct Memory Chat Handler (1 ⚡ Social Battery per reply, +2+ affinity)
  const handleSendChatMessage = useCallback(
    async (text: string) => {
      if (!hasConfiguredApiKey()) {
        setApiKeyModalState({ open: true, canClose: true });
        return;
      }

      const freshBattery = readSocialBattery();
      setSocialBattery(freshBattery);
      if (freshBattery.energy < 1) {
        return;
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-u`,
        sender: 'user',
        text,
        createdAt: Date.now(),
      };
      if (sentChatCountRef.current === null) {
        sentChatCountRef.current = chatMessages.filter((m) => m.sender === 'user').length;
      }
      sentChatCountRef.current += 1;
      const shouldSummarizeMemory = sentChatCountRef.current % 8 === 0;

      setChatMessages((prev) => [...prev, userMsg]);
      setChatError(null);
      setChatSending(true);

      try {
        const pet = petRef.current;
        pet.secondsWithoutAttention = 0;
        const mood = describePetMood(pet);
        const recentArtTitles = artworksRef.current.slice(0, 5).map((art) => art.title);
        const recentDiscoveryTitles = discoveriesRef.current
          .slice(0, 5)
          .map((disc) => disc.topic);

        const res = await chatWithPet({
          message: text,
          petName: pet.name,
          mood,
          affinity: pet.affinity,
          hunger: pet.hunger,
          energy: pet.energy,
          health: pet.health,
          isGrumpy: pet.grumpyTimer > 0 || pet.affinity < 40,
          weather: weatherRef.current,
          longTermMemory: pet.longTermMemory,
          recentArtTitles,
          recentDiscoveryTitles,
          recentEvents: pet.recentEvents.slice(0, 4),
          history: chatMessages.slice(-6),
        });

        if (!res.ok || !res.data.reply) {
          if (!res.ok && res.code === 'NO_API_KEY') {
            setApiKeyModalState({ open: true, canClose: true });
          } else {
            const errText = res.ok
              ? 'Seu pet ficou pensativo e não concluiu a resposta. Tente novamente!'
              : res.error;
            setChatError(errText);
            if (!res.ok && res.code === 'INVALID_API_KEY') {
              showSafeApiBanner(errText);
            }
          }
          return;
        }

        handleConsumeSocialBattery(1);

        const petMsg: ChatMessage = {
          id: `msg-${Date.now()}-p`,
          sender: 'pet',
          text: res.data.reply,
          createdAt: Date.now(),
        };
        setChatMessages((prev) => [...prev, petMsg]);
        setChatError(null);
        setApiErrorBanner(null);
        soundFx.playChatReply();

        const affDelta = Math.max(2, res.data.affinityDelta ?? 2);
        pet.affinity = Math.max(0, Math.min(100, pet.affinity + affDelta));
        if (res.data.traitKey && res.data.traitDelta) {
          pet.traits[res.data.traitKey] = Math.min(
            100,
            pet.traits[res.data.traitKey] + res.data.traitDelta
          );
        }
        if (pet.grumpyTimer > 0) {
          pet.grumpyTimer = Math.max(0, pet.grumpyTimer - 6);
        }
        addFloatingNotice(pet.x, pet.y - 34, `+${affDelta} Afinidade`, '#EC4899');
        setHudStats((prev) => ({
          ...prev,
          affinity: pet.affinity,
        }));
        pet.pendingDiaryEntry = true;
        pushPetMemory(pet, `Conversei com o humano sobre: "${text.slice(0, 50)}"`);

        pet.bubbleText =
          res.data.reply.length > 72 ? `${res.data.reply.slice(0, 69)}...` : res.data.reply;
        pet.bubbleKind = 'speech';
        pet.bubbleTimer = 4.2;

        if (shouldSummarizeMemory) {
          void runBackgroundMemoryUpdate([...chatMessages.slice(-6), userMsg, petMsg]);
        }
      } catch {
        setChatError('Seu pet se distraiu por um momento. Tente enviar novamente!');
      } finally {
        setChatSending(false);
      }
    },
    [
      addFloatingNotice,
      chatMessages,
      handleConsumeSocialBattery,
      runBackgroundMemoryUpdate,
      showSafeApiBanner,
    ]
  );

  // Main 60 FPS Simulation & Canvas Render Loop
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let hudSyncAccum = 0;
    let gardenSyncAccum = 0;
    let saveAccum = 0;
    let dustAccum = 0;

    const tick = (now: number) => {
      const dtReal = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const timeSec = now / 1000;

      // Advance watered backyard garden plots
      let stageChanged = false;
      let anyGrowing = false;
      const nextPlots = gardenPlotsRef.current.map((plot) => {
        if (!plot.seed || !plot.watered || plot.stage >= 3) return plot;
        anyGrowing = true;
        const info = SEED_CATALOG[plot.seed];
        const nextProgress = Math.min(
          1,
          plot.growthProgress + (dtReal * timeScaleRef.current) / info.growthSeconds
        );
        const nextStage: 0 | 1 | 2 | 3 =
          nextProgress >= 1 ? 3 : nextProgress >= 0.5 ? 2 : 1;
        if (nextStage !== plot.stage) {
          stageChanged = true;
          if (nextStage === 3) {
            addFloatingNotice(plot.x, plot.y - 26, 'Pronto para colher!', '#16A34A');
          }
        }
        return {
          ...plot,
          growthProgress: nextProgress,
          stage: nextStage,
          watered: nextStage < 3,
        };
      });
      if (anyGrowing) {
        gardenPlotsRef.current = nextPlots;
        gardenSyncAccum += dtReal;
        if (stageChanged || gardenSyncAccum >= 0.5) {
          gardenSyncAccum = 0;
          setGardenPlots(nextPlots);
        }
      }

      const autoAiBlocked = !canRunAutonomousAi();
      stepPetSimulation(
        petRef.current,
        furnitureRef.current,
        gardenPlotsRef.current,
        coinsRef.current,
        dtReal,
        timeScaleRef.current,
        timeOfDayRef.current,
        weatherRef.current,
        paintInFlightRef.current || chatActiveRef.current || autoAiBlocked,
        discoveryInFlightRef.current || chatActiveRef.current || autoAiBlocked,
        diaryInFlightRef.current || chatActiveRef.current || autoAiBlocked,
        {
          onConsumeFood: (furnitureId) => {
            const updated = furnitureRef.current.map((item) =>
              item.id === furnitureId
                ? { ...item, foodStock: Math.max(0, item.foodStock - 1) }
                : item
            );
            furnitureRef.current = updated;
            setFurniture(updated);
          },
          onHarvestPlot: (plotId, seed) => {
            const targetPlot = gardenPlotsRef.current.find((p) => p.id === plotId);
            const updated = gardenPlotsRef.current.map((p) =>
              p.id === plotId
                ? { ...p, seed: null, stage: 0 as const, watered: false, growthProgress: 0 }
                : p
            );
            gardenPlotsRef.current = updated;
            setGardenPlots(updated);
            if (targetPlot) {
              addFloatingNotice(
                targetPlot.x,
                targetPlot.y - 26,
                seed === 'sunflower' ? '+Inspiração!' : '+Horta colhida!',
                seed === 'sunflower' ? '#D97706' : '#16A34A'
              );
            }
          },
          onFinishWork: (rewardCoins, gigTitle) => {
            setCoins((c) => {
              const next = c + rewardCoins;
              coinsRef.current = next;
              return next;
            });
            soundFx.playCoin();
            addFloatingNotice(
              WORK_GATE.approachX,
              WORK_GATE.approachY - 30,
              `+${rewardCoins} moedas`,
              '#D97706'
            );
            pushPetMemory(
              petRef.current,
              `Voltei do trabalho (${gigTitle}) e ganhei +${rewardCoins} moedas!`
            );
          },
          onStartPainting: (snapshot) => {
            void handleRequestArtwork(snapshot);
          },
          onStartDiscovery: (snapshot) => {
            void handleRequestDiscovery(snapshot);
          },
          onStartDiary: (snapshot) => {
            void handleRequestDiary(snapshot);
          },
          onPlayEatSound: () => {
            soundFx.playEat();
          },
          onPlayKickSound: () => {
            soundFx.playKick();
          },
          onIdleAffinityDecay: (loss) => {
            addFloatingNotice(
              petRef.current.x,
              petRef.current.y - 34,
              `-${loss} Afinidade (sem atenção)`,
              '#DC2626'
            );
          },
        },
        petRadialMenuRef.current.open
      );

      // Voice blips when a new speech/thought bubble appears
      const curBubble = petRef.current.bubbleText;
      if (curBubble !== lastSpokenBubbleRef.current) {
        lastSpokenBubbleRef.current = curBubble;
        if (curBubble && petRef.current.bubbleKind !== 'icon') {
          const isGrumpyNow = petRef.current.grumpyTimer > 0 || petRef.current.affinity < 40;
          soundFx.playPetVoice(
            isGrumpyNow ? 'grumpy' : petRef.current.bubbleKind === 'thought' ? 'thought' : 'happy',
            isGrumpyNow ? 2 : 3
          );
        }
      }

      // If raining, automatically water any newly planted unwatered plots
      if (
        weatherRef.current === 'rainy' &&
        gardenPlotsRef.current.some((p) => p.seed && p.stage < 3 && !p.watered)
      ) {
        waterPlotsFromRain();
      }

      // Live Flagra check if player is currently sneaking a peek at the diary
      if (
        diaryModalRef.current.open &&
        diaryModalRef.current.phase === 'reading_sneak' &&
        diaryModalRef.current.furnitureId
      ) {
        const diaryFurn = furnitureRef.current.find(
          (f) => f.id === diaryModalRef.current.furnitureId
        );
        if (diaryFurn && isPetSeeingFurniture(petRef.current, diaryFurn)) {
          triggerDiaryCaught();
        }
      }

      if (noticesRef.current.length > 0) {
        noticesRef.current = noticesRef.current
          .map((n) => ({ ...n, timer: n.timer - dtReal }))
          .filter((n) => n.timer > 0);
      }

      // Dust puffs at the pet's feet when walking fast
      const petSpeed = Math.hypot(petRef.current.vx, petRef.current.vy);
      if (
        petRef.current.state !== 'WORKING' &&
        (petSpeed > 110 || (timeScaleRef.current > 1 && petSpeed > 55))
      ) {
        dustAccum += dtReal;
        if (dustAccum >= 0.14) {
          dustAccum = 0;
          spawnParticleBurst(
            petRef.current.x - petRef.current.lookX * 6,
            petRef.current.y + 15,
            'dust',
            2
          );
        }
      } else {
        dustAccum = 0.08;
      }

      if (heartsRef.current.length > 0) {
        heartsRef.current = heartsRef.current
          .map((h) => ({
            ...h,
            x: h.x + h.vx * dtReal,
            y: h.y + h.vy * dtReal,
            vy: h.kind === 'water' ? h.vy + 220 * dtReal : h.vy,
            timer: h.timer - dtReal,
          }))
          .filter((h) => h.timer > 0);
      }

      const cam = cameraRef.current;
      if (cam.follow) {
        const lerp = 1 - Math.exp(-5.5 * dtReal);
        cam.x += (petRef.current.x - cam.x) * lerp;
        cam.y += (petRef.current.y - cam.y) * lerp;
      }

      cam.x = Math.max(120, Math.min(WORLD_WIDTH - 120, cam.x));
      cam.y = Math.max(100, Math.min(WORLD_HEIGHT - 100, cam.y));

      hudSyncAccum += dtReal;
      if (hudSyncAccum >= 0.18) {
        hudSyncAccum = 0;
        const p = petRef.current;
        setHudStats({
          name: p.name,
          hunger: p.hunger,
          energy: p.energy,
          mentalEnergy: p.mentalEnergy,
          health: p.health,
          inspiration: p.inspiration,
          affinity: p.affinity,
          traits: { ...p.traits },
          mood: describePetMood(p),
          workCount: p.workCount,
          state: p.state,
        });
      }

      saveAccum += dtReal;
      if (saveAccum >= 1.5) {
        saveAccum = 0;
        persistPetSnapshot(petRef.current);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          const hoverPos = hoverWorldRef.current;
          const movingItem = movingFurnitureIdRef.current
            ? furnitureRef.current.find((f) => f.id === movingFurnitureIdRef.current)
            : null;
          const activeGhostType = movingItem?.type ?? placingTypeRef.current;
          const canPlace =
            Boolean(activeGhostType && hoverPos) &&
            canPlaceFurniture(
              hoverPos!.x,
              hoverPos!.y,
              FURNITURE_CATALOG[activeGhostType!].radius,
              furnitureRef.current,
              movingItem?.id
            );

          renderWorldCanvas({
            ctx,
            viewportWidth: rect.width,
            viewportHeight: rect.height,
            cameraX: cam.x,
            cameraY: cam.y,
            zoom: cam.zoom,
            timeSec,
            timeOfDay: timeOfDayRef.current,
            weather: weatherRef.current,
            pet: petRef.current,
            furniture: furnitureRef.current,
            gardenPlots: gardenPlotsRef.current,
            activeSeedToPlant: activeSeedRef.current,
            hoveredPlotId: hoveredPlotIdRef.current,
            hoveredGate: hoveredGateRef.current,
            placingType: activeGhostType,
            hoverWorldPos: hoverPos,
            canPlaceAtHover: canPlace,
            hoveredFurnitureId: hoveredFurnitureIdRef.current,
            selectedFurnitureId: selectedFurnitureIdRef.current,
            notices: noticesRef.current,
            hearts: heartsRef.current,
          });

          ctx.restore();
        }
      }

      animId = window.requestAnimationFrame(tick);
    };

    animId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animId);
  }, [
    addFloatingNotice,
    handleRequestArtwork,
    handleRequestDiary,
    handleRequestDiscovery,
    persistPetSnapshot,
    spawnParticleBurst,
    triggerDiaryCaught,
    waterPlotsFromRain,
  ]);

  const screenToWorld = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - rect.width / 2) / cam.zoom + cam.x,
      y: (sy - rect.height / 2) / cam.zoom + cam.y,
    };
  }, []);

  const worldToScreen = useCallback((worldX: number, worldY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: rect.left + rect.width / 2 + (worldX - cam.x) * cam.zoom,
      y: rect.top + rect.height / 2 + (worldY - cam.y) * cam.zoom,
    };
  }, []);

  const performPetting = useCallback(
    (source: 'stroke' | 'menu') => {
      const pet = petRef.current;
      if (pet.state === 'WORKING') return;
      pet.secondsWithoutAttention = 0;

      if (pet.affinity < 40) {
        // Grumpy pet pulls away and grumbles without consuming a slot
        const candidates: Vec2[] = [
          { x: pet.x + 70, y: pet.y + 20 },
          { x: pet.x - 70, y: pet.y + 20 },
          { x: pet.x, y: pet.y - 68 },
          getRandomIndoorWalkablePoint(),
        ];
        const escapeTarget =
          candidates.find((pt) => !isPointBlocked(pt.x, pt.y, 18)) ?? candidates[3];
        pet.interactionPauseTimer = 0;
        pet.targetFurnitureId = null;
        pet.targetPlotId = null;
        pet.path = findPath(pet, escapeTarget);
        pet.state = 'WANDERING';
        pet.stateTimer = 2.4;
        pet.grumpyTimer = Math.max(pet.grumpyTimer, 14);
        pet.bubbleText = 'Hmph! Não tô afim de carinho agora!';
        pet.bubbleKind = 'speech';
        pet.bubbleTimer = 3.4;
        lastSpokenBubbleRef.current = pet.bubbleText;
        soundFx.playPetVoice('grumpy', 3);
        addFloatingNotice(pet.x, pet.y - 34, 'Emburrado! Se afastou...', '#DC2626');
        return;
      }

      const nowMs = Date.now();
      if (source === 'stroke' && nowMs - lastPetPatAtRef.current < 3000) {
        return;
      }

      const remainingMs =
        lastPetTimeRef.current > 0
          ? Math.max(0, SOCIAL_COOLDOWN_MS - (nowMs - lastPetTimeRef.current))
          : 0;
      if (remainingMs > 0) {
        const timerText = formatCountdownClock(remainingMs);
        pet.bubbleText = `Já recebi carinho agora! Aguarde ${timerText}.`;
        pet.bubbleKind = 'thought';
        pet.bubbleTimer = 3.0;
        lastSpokenBubbleRef.current = pet.bubbleText;
        addFloatingNotice(pet.x, pet.y - 34, `Carinho (${timerText})`, '#6C6054');
        return;
      }

      lastPetPatAtRef.current = nowMs;
      lastPetTimeRef.current = nowMs;
      setLastPetTime(nowMs);
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_PET_TIME, String(nowMs));
      } catch {
        // Ignore storage quota errors
      }

      pet.interactionPauseTimer = Math.max(pet.interactionPauseTimer, 2.2);
      pet.happyEyesTimer = 1.9;
      spawnHeartBurst(pet.x, pet.y - 16, source === 'stroke' ? 3 : 5);
      soundFx.playPetPurr();

      pet.affinity = Math.min(100, pet.affinity + 2);
      pet.mentalEnergy = Math.min(100, pet.mentalEnergy + 4);
      pet.traits.carinhoso = Math.min(100, pet.traits.carinhoso + 1);
      if (pet.grumpyTimer > 0) {
        pet.grumpyTimer = Math.max(0, pet.grumpyTimer - 6);
      }
      pet.bubbleText = 'Prrr... adoro seu carinho!';
      pet.bubbleKind = 'speech';
      pet.bubbleTimer = 3.0;
      lastSpokenBubbleRef.current = pet.bubbleText;
      pet.pendingDiaryEntry = true;
      pushPetMemory(pet, 'Recebi muito carinho do meu humano!');
      addFloatingNotice(pet.x, pet.y - 34, '+2 Afinidade · +4 Mental', '#EC4899');
      setHudStats((prev) => ({
        ...prev,
        affinity: pet.affinity,
        mentalEnergy: pet.mentalEnergy,
      }));
    },
    [addFloatingNotice, spawnHeartBurst]
  );

  const performPraise = useCallback(() => {
    const pet = petRef.current;
    if (pet.state === 'WORKING') return;
    pet.secondsWithoutAttention = 0;

    const nowMs = Date.now();
    const activePraiseCooldownMs =
      pet.affinity < 40 ? PRAISE_GRUMPY_COOLDOWN_MS : SOCIAL_COOLDOWN_MS;
    const remainingMs =
      lastPraiseTimeRef.current > 0
        ? Math.max(0, activePraiseCooldownMs - (nowMs - lastPraiseTimeRef.current))
        : 0;
    if (remainingMs > 0) {
      const timerText = formatCountdownClock(remainingMs);
      pet.bubbleText = `Elogios demais por agora! Aguarde ${timerText}.`;
      pet.bubbleKind = 'thought';
      pet.bubbleTimer = 3.0;
      lastSpokenBubbleRef.current = pet.bubbleText;
      addFloatingNotice(pet.x, pet.y - 34, `Elogiar (${timerText})`, '#6C6054');
      return;
    }

    lastPraiseTimeRef.current = nowMs;
    setLastPraiseTime(nowMs);
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_PRAISE_TIME, String(nowMs));
    } catch {
      // Ignore storage quota errors
    }

    if (pet.affinity < 40) {
      const praiseGain = pet.affinity < 15 ? 4 : 3;
      pet.interactionPauseTimer = Math.max(pet.interactionPauseTimer, 2.2);
      pet.affinity = Math.min(100, pet.affinity + praiseGain);
      pet.grumpyTimer = Math.max(0, pet.grumpyTimer - 12);
      pet.bubbleText =
        pet.affinity < 15
          ? 'Hmph... valeu por tentar se aproximar.'
          : 'Hmph... obrigado por lembrar de mim.';
      pet.bubbleKind = 'speech';
      pet.bubbleTimer = 3.4;
      lastSpokenBubbleRef.current = pet.bubbleText;
      spawnParticleBurst(pet.x, pet.y - 16, 'star', 3);
      soundFx.playPetVoice('happy', 2);
      addFloatingNotice(pet.x, pet.y - 34, `+${praiseGain} Afinidade`, '#D97706');
    } else {
      pet.interactionPauseTimer = Math.max(pet.interactionPauseTimer, 2.8);
      pet.affinity = Math.min(100, pet.affinity + 3);
      pet.mentalEnergy = Math.min(100, pet.mentalEnergy + 6);
      pet.inspiration = Math.min(100, pet.inspiration + 4);
      pet.traits.carinhoso = Math.min(100, pet.traits.carinhoso + 1);
      pet.happyEyesTimer = 2.2;
      pet.isLookingAtScreen = true;
      pet.bubbleText = 'Sério?! Você é o melhor humano do mundo!';
      pet.bubbleKind = 'speech';
      pet.bubbleTimer = 3.4;
      lastSpokenBubbleRef.current = pet.bubbleText;
      spawnParticleBurst(pet.x, pet.y - 16, 'star', 6);
      soundFx.playCheer();
      pushPetMemory(pet, 'Meu humano me elogiou e me deu bastante atenção!');
      addFloatingNotice(pet.x, pet.y - 34, '+3 Afinidade · +6 Mental', '#D97706');
    }

    setHudStats((prev) => ({
      ...prev,
      affinity: pet.affinity,
      mentalEnergy: pet.mentalEnergy,
      inspiration: pet.inspiration,
    }));
  }, [addFloatingNotice, spawnParticleBurst]);

  const findFurnitureAt = useCallback((worldPos: Vec2): PlacedFurniture | null => {
    for (let i = furnitureRef.current.length - 1; i >= 0; i--) {
      const item = furnitureRef.current[i];
      const r = FURNITURE_CATALOG[item.type].radius + 10;
      if (Math.hypot(worldPos.x - item.x, worldPos.y - item.y) <= r) {
        return item;
      }
    }
    return null;
  }, []);

  const findPlotAt = useCallback((worldPos: Vec2): GardenPlot | null => {
    for (const plot of gardenPlotsRef.current) {
      if (Math.hypot(worldPos.x - plot.x, worldPos.y - plot.y) <= 46) {
        return plot;
      }
    }
    return null;
  }, []);

  const isPointOnWorkGate = useCallback((worldPos: Vec2): boolean => {
    return Math.hypot(worldPos.x - WORK_GATE.x, worldPos.y - WORK_GATE.y) <= 52;
  }, []);

  const isPointOnPet = useCallback((worldPos: Vec2): boolean => {
    const pet = petRef.current;
    if (pet.state === 'WORKING') return false;
    return Math.hypot(worldPos.x - pet.x, worldPos.y - pet.y) <= 36;
  }, []);

  const handleFeedFromFridge = useCallback(
    (id?: string) => {
      const target = id
        ? furnitureRef.current.find((f) => f.id === id && f.type === 'fridge')
        : furnitureRef.current.find((f) => f.type === 'fridge' && f.foodStock > 0);

      if (!target || target.foodStock <= 0) {
        addFloatingNotice(petRef.current.x, petRef.current.y - 24, 'Geladeira vazia!', '#DC2626');
        return;
      }

      const updated = furnitureRef.current.map((item) =>
        item.id === target.id ? { ...item, foodStock: Math.max(0, item.foodStock - 1) } : item
      );
      furnitureRef.current = updated;
      setFurniture(updated);

      const pet = petRef.current;
      pet.secondsWithoutAttention = 0;
      pet.hunger = Math.min(100, pet.hunger + 25);
      pet.health = Math.min(100, pet.health + 5);
      pet.affinity = Math.min(100, pet.affinity + 3);
      pet.traits.carinhoso = Math.min(100, pet.traits.carinhoso + 1);
      if (pet.grumpyTimer > 0) pet.grumpyTimer = Math.max(0, pet.grumpyTimer - 8);
      pet.pendingDiaryEntry = true;
      pet.bubbleText =
        pet.affinity < 40
          ? 'Hmph... obrigado pela comida.'
          : 'Comidinha da geladeira! Delícia!';
      pet.bubbleKind = 'speech';
      pet.bubbleTimer = 3.2;
      lastSpokenBubbleRef.current = pet.bubbleText;
      pushPetMemory(pet, 'O humano me alimentou com comida da geladeira!');
      soundFx.playEat();
      addFloatingNotice(pet.x, pet.y - 30, '+25 Fome · +3 Afinidade', '#16A34A');
      setHudStats((prev) => ({
        ...prev,
        hunger: pet.hunger,
        health: pet.health,
        affinity: pet.affinity,
      }));
    },
    [addFloatingNotice]
  );

  const handleRefillFridgePaid = useCallback(
    (id?: string) => {
      const target = id
        ? furnitureRef.current.find((f) => f.id === id && f.type === 'fridge')
        : furnitureRef.current.find((f) => f.type === 'fridge');

      if (!target) {
        addFloatingNotice(petRef.current.x, petRef.current.y - 24, 'Sem geladeira!', '#DC2626');
        return;
      }
      if (target.foodStock >= target.maxFoodStock) {
        addFloatingNotice(target.x, target.y - 24, 'Geladeira já cheia!', '#0284C7');
        return;
      }
      if (coinsRef.current < 15) {
        addFloatingNotice(target.x, target.y - 24, 'Moedas insuficientes!', '#DC2626');
        return;
      }

      setCoins((c) => {
        const next = Math.max(0, c - 15);
        coinsRef.current = next;
        return next;
      });

      const updated = furnitureRef.current.map((item) =>
        item.id === target.id ? { ...item, foodStock: item.maxFoodStock } : item
      );
      furnitureRef.current = updated;
      setFurniture(updated);
      soundFx.playRefill();

      const pet = petRef.current;
      pet.secondsWithoutAttention = 0;
      pet.affinity = Math.min(100, pet.affinity + 3);
      pet.traits.carinhoso = Math.min(100, pet.traits.carinhoso + 2);
      if (pet.grumpyTimer > 0) pet.grumpyTimer = Math.max(0, pet.grumpyTimer - 6);
      pushPetMemory(pet, 'O humano comprou comida e encheu minha geladeira!');
      addFloatingNotice(target.x, target.y - 26, '+Comida! · +3 Afinidade', '#059669');
      setHudStats((prev) => ({
        ...prev,
        affinity: pet.affinity,
      }));
    },
    [addFloatingNotice]
  );

  const handleRemoveFurniture = useCallback(
    (id: string) => {
      const target = furnitureRef.current.find((f) => f.id === id);
      const updated = furnitureRef.current.filter((item) => item.id !== id);
      furnitureRef.current = updated;
      setFurniture(updated);
      if (target) {
        addFloatingNotice(target.x, target.y - 20, 'Removido', '#DC2626');
      }
      setSelectedFurnitureId(null);
      soundFx.playRemove();
    },
    [addFloatingNotice]
  );

  const handleOpenDiaryModal = useCallback((furnitureId: string) => {
    setDiaryModal({
      open: true,
      furnitureId,
      phase: 'choice',
    });
  }, []);

  const handleAskDiaryPermission = () => {
    const pet = petRef.current;
    if (pet.affinity >= 60) {
      pet.bubbleText = 'Claro! Confio em você!';
      pet.bubbleKind = 'speech';
      pet.bubbleTimer = 3.5;
      setDiaryModal((prev) => ({ ...prev, phase: 'reading_permitted' }));
    } else {
      pet.bubbleText = 'Ainda tenho vergonha de mostrar...';
      pet.bubbleKind = 'speech';
      pet.bubbleTimer = 3.5;
      setDiaryModal((prev) => ({ ...prev, phase: 'refused' }));
    }
  };

  const handleSneakReadDiary = () => {
    const diaryFurn = furnitureRef.current.find((f) => f.id === diaryModal.furnitureId);
    if (diaryFurn && isPetSeeingFurniture(petRef.current, diaryFurn)) {
      triggerDiaryCaught();
      return;
    }
    setDiaryModal((prev) => ({ ...prev, phase: 'reading_sneak' }));
  };

  // Shop handlers
  const handleBuyFurniture = (type: FurnitureType) => {
    const info = FURNITURE_CATALOG[type];
    if (coinsRef.current < info.price) return;
    cancelPlacementOrSeed();
    setCoins((c) => {
      const next = Math.max(0, c - info.price);
      coinsRef.current = next;
      return next;
    });
    placingPaidPriceRef.current = info.price;
    setPlacingType(type);
    setSelectedFurnitureId(null);
    setShopOpen(false);
    soundFx.playCoin();
  };

  const handleBuyRefill = () => {
    handleRefillFridgePaid();
    setShopOpen(false);
  };

  const handleBuyTreat = () => {
    if (coinsRef.current < 10) return;
    setCoins((c) => {
      const next = Math.max(0, c - 10);
      coinsRef.current = next;
      return next;
    });
    const pet = petRef.current;
    pet.secondsWithoutAttention = 0;
    pet.hunger = Math.min(100, pet.hunger + 25);
    pet.health = Math.min(100, pet.health + 10);
    pet.affinity = Math.min(100, pet.affinity + 4);
    pet.traits.carinhoso = Math.min(100, pet.traits.carinhoso + 2);
    if (pet.grumpyTimer > 0) pet.grumpyTimer = Math.max(0, pet.grumpyTimer - 8);
    pet.pendingDiaryEntry = true;
    pet.bubbleText = 'Que petisco delicioso! Obrigado!';
    pet.bubbleKind = 'speech';
    pet.bubbleTimer = 3.5;
    pushPetMemory(pet, 'Ganhei um petisco saudável delicioso!');
    soundFx.playEat();
    addFloatingNotice(pet.x, pet.y - 30, '+25 Fome · +4 Afinidade', '#16A34A');
    setHudStats((prev) => ({
      ...prev,
      hunger: pet.hunger,
      health: pet.health,
      affinity: pet.affinity,
    }));
    setShopOpen(false);
  };

  const handleBuySeed = (seed: SeedType) => {
    const info = SEED_CATALOG[seed];
    if (coinsRef.current < info.price) return;
    cancelPlacementOrSeed();
    setCoins((c) => {
      const next = Math.max(0, c - info.price);
      coinsRef.current = next;
      return next;
    });
    seedPaidPriceRef.current = info.price;
    setActiveSeedToPlant(seed);
    setSelectedFurnitureId(null);
    setShopOpen(false);
    soundFx.playCoin();
  };

  const handleSelectWorkGig = (gig: WorkGig) => {
    const pet = petRef.current;
    if (pet.state === 'WORKING') return;
    const outcome = sendPetToWork(pet, gig);
    setWorkGateOpen(false);
    if (!outcome.accepted) {
      soundFx.playStartle();
      addFloatingNotice(pet.x, pet.y - 34, 'Recusou trabalhar (Emburrado!)', '#DC2626');
      return;
    }
    soundFx.playPlace();
    if (outcome.exploitedPenalty > 0) {
      soundFx.playStartle();
      addFloatingNotice(
        pet.x,
        pet.y - 34,
        `-${outcome.exploitedPenalty} Afinidade (Exploração!)`,
        '#DC2626'
      );
    }
  };

  const handlePenaltyComplete = (result: {
    goals: number;
    saves: number;
    maxKicks: number;
  }) => {
    const pet = petRef.current;
    const perfectDefense = result.saves === result.maxKicks && result.goals === 0;
    const affinityGain = perfectDefense ? 14 : 10;

    pet.health = Math.min(100, pet.health + 18);
    pet.inspiration = Math.min(100, pet.inspiration + 16);
    pet.boredom = 0;
    pet.affinity = Math.min(100, pet.affinity + affinityGain);
    pet.secondsWithoutAttention = 0;
    if (pet.grumpyTimer > 0) {
      pet.grumpyTimer = Math.max(0, pet.grumpyTimer - 12);
    }
    pet.pendingDiaryEntry = true;
    pet.bubbleKind = 'speech';
    pet.bubbleTimer = 4.4;

    if (perfectDefense) {
      pet.bubbleText = 'DEFENDI TODOS OS PÊNALTIS!! 🏆';
      const celebrationMsg: ChatMessage = {
        id: `msg-${Date.now()}-gk`,
        sender: 'pet',
        text: `DEFENDI TODOS OS ${result.maxKicks} PÊNALTIS!! 🏆🧤 Nenhuma bola passou por mim hoje! Tô muito orgulhoso, obrigado por jogar comigo!`,
        createdAt: Date.now(),
      };
      setChatMessages((prev) => [...prev, celebrationMsg]);
      soundFx.playArtworkReady();
    } else {
      pet.bubbleText = 'Que partida divertida! Tô cheio de energia!';
      soundFx.playChatReply();
    }

    pushPetMemory(
      pet,
      `Jogamos pênaltis juntos! Foram ${result.goals} gols e ${result.saves} defesas minhas.`
    );
    addFloatingNotice(
      pet.x,
      pet.y - 32,
      `+18 Saúde · +16 Felicidade · +${affinityGain} Afinidade`,
      '#16A34A'
    );
    setPenaltyOpen(false);
  };

  const handleConfirmCompanion = (payload: {
    name: string;
    appearance: PetAppearance;
    traits: PetTraits;
    tagline: string;
  }) => {
    const freshPet = createDefaultPet({
      name: payload.name,
      appearance: payload.appearance,
      traits: payload.traits,
      bubbleText: payload.tagline,
    });
    petRef.current = freshPet;
    const starterFurniture = DEFAULT_FURNITURE.map((item) => ({ ...item }));
    const starterGarden = DEFAULT_GARDEN_PLOTS.map((plot) => ({ ...plot }));

    furnitureRef.current = starterFurniture;
    gardenPlotsRef.current = starterGarden;
    coinsRef.current = 100;

    setFurniture(starterFurniture);
    setGardenPlots(starterGarden);
    setCoins(100);
    setArtworks([]);
    setDiscoveries([]);
    setDiaryEntries([]);
    setChatMessages([]);
    setSelectedFurnitureId(null);
    setPlacingType(null);
    setMovingFurnitureId(null);
    setActiveSeedToPlant(null);
    placingPaidPriceRef.current = 0;
    seedPaidPriceRef.current = 0;
    cameraRef.current = { x: freshPet.x, y: freshPet.y, zoom: 1, follow: true };
    setCameraFollowsPet(true);

    sentChatCountRef.current = 0;
    lastPetTimeRef.current = 0;
    lastPraiseTimeRef.current = 0;
    setLastPetTime(0);
    setLastPraiseTime(0);
    try {
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, '1');
      localStorage.removeItem(STORAGE_KEYS.LAST_PET_TIME);
      localStorage.removeItem(STORAGE_KEYS.LAST_PRAISE_TIME);
      persistPetSnapshot(freshPet);
    } catch {
      // Ignore storage quota errors
    }

    soundFx.playArtworkReady();
    setCreatorState({ open: false, canCancel: true });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      cancelPlacementOrSeed();
      return;
    }
    const worldPos = screenToWorld(e.clientX, e.clientY);
    if (!worldPos) return;

    // 1. Placing newly bought furniture
    if (placingTypeRef.current) {
      const type = placingTypeRef.current;
      const radius = FURNITURE_CATALOG[type].radius;
      if (canPlaceFurniture(worldPos.x, worldPos.y, radius, furnitureRef.current)) {
        const newItem: PlacedFurniture = {
          id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type,
          x: Math.round(worldPos.x),
          y: Math.round(worldPos.y),
          foodStock: type === 'fridge' ? 4 : 0,
          maxFoodStock: type === 'fridge' ? 4 : 0,
          noveltyBoost: 1.0,
        };
        const updated = [...furnitureRef.current, newItem];
        furnitureRef.current = updated;
        setFurniture(updated);
        addFloatingNotice(newItem.x, newItem.y - 24, FURNITURE_CATALOG[type].shortName, '#D97706');
        soundFx.playPlace();

        const pet = petRef.current;
        pet.secondsWithoutAttention = 0;
        pet.affinity = Math.min(100, pet.affinity + 2);
        pet.pendingDiaryEntry = true;
        if (pet.state === 'WANDERING') {
          pet.stateTimer = Math.min(pet.stateTimer, 0.25);
        }
        pushPetMemory(pet, `Ganhei um novo objeto na casa: ${FURNITURE_CATALOG[type].name}!`);

        placingPaidPriceRef.current = 0;
        setPlacingType(null);
        setSelectedFurnitureId(null);
      } else {
        addFloatingNotice(worldPos.x, worldPos.y - 14, 'Espaço bloqueado', '#DC2626');
      }
      return;
    }

    // 2. Repositioning existing furniture
    if (movingFurnitureIdRef.current) {
      const moveId = movingFurnitureIdRef.current;
      const target = furnitureRef.current.find((f) => f.id === moveId);
      if (target) {
        const radius = FURNITURE_CATALOG[target.type].radius;
        if (canPlaceFurniture(worldPos.x, worldPos.y, radius, furnitureRef.current, moveId)) {
          const updated = furnitureRef.current.map((item) =>
            item.id === moveId
              ? { ...item, x: Math.round(worldPos.x), y: Math.round(worldPos.y) }
              : item
          );
          furnitureRef.current = updated;
          setFurniture(updated);
          petRef.current.secondsWithoutAttention = 0;
          addFloatingNotice(worldPos.x, worldPos.y - 24, 'Reposicionado!', '#D97706');
          soundFx.playPlace();
          setMovingFurnitureId(null);
          setSelectedFurnitureId(moveId);
        } else {
          addFloatingNotice(worldPos.x, worldPos.y - 14, 'Espaço bloqueado', '#DC2626');
        }
      } else {
        setMovingFurnitureId(null);
      }
      return;
    }

    // 3. Planting bought seed in a backyard plot
    if (activeSeedRef.current) {
      const seed = activeSeedRef.current;
      const plot = findPlotAt(worldPos);
      if (!plot) {
        addFloatingNotice(worldPos.x, worldPos.y - 14, 'Clique em um canteiro!', '#DC2626');
        return;
      }
      if (plot.seed) {
        addFloatingNotice(plot.x, plot.y - 20, 'Canteiro ocupado!', '#DC2626');
        return;
      }
      const updated = gardenPlotsRef.current.map((p) =>
        p.id === plot.id
          ? { ...p, seed, stage: 1 as const, watered: true, growthProgress: 0 }
          : p
      );
      gardenPlotsRef.current = updated;
      setGardenPlots(updated);
      petRef.current.secondsWithoutAttention = 0;
      seedPaidPriceRef.current = 0;
      setActiveSeedToPlant(null);
      spawnParticleBurst(plot.x, plot.y - 6, 'water', 6);
      soundFx.playWater();
      addFloatingNotice(plot.x, plot.y - 26, 'Plantado & Regado!', '#16A34A');
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    // Clicking / touching directly on the pet initiates tap menu (pauses movement) or stroke-petting on drag
    if (isPointOnPet(worldPos)) {
      e.stopPropagation();
      const pet = petRef.current;
      pet.interactionPauseTimer = Math.max(pet.interactionPauseTimer, 5.0);
      pet.vx = 0;
      pet.vy = 0;
      petStrokeRef.current = {
        active: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        lastX: worldPos.x,
        lastY: worldPos.y,
        strokeAccum: 0,
        didStroke: false,
        lastHeartAt: 0,
      };
      return;
    }

    if (petRadialMenuRef.current.open) {
      if (Date.now() - petRadialMenuRef.current.openedAtTimestamp < 300) {
        return;
      }
      setPetRadialMenu((prev) => ({ ...prev, open: false }));
    }

    dragStateRef.current = {
      active: true,
      moved: false,
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startCamX: cameraRef.current.x,
      startCamY: cameraRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    hoverWorldRef.current = worldPos;

    // Handle direct stroke petting on the pet ONLY after deliberate drag (>= 12px) so taps never conflict
    const stroke = petStrokeRef.current;
    if (stroke.active && worldPos) {
      const pet = petRef.current;
      const screenMoved = Math.hypot(
        e.clientX - stroke.startScreenX,
        e.clientY - stroke.startScreenY
      );
      const moveDist = Math.hypot(worldPos.x - stroke.lastX, worldPos.y - stroke.lastY);
      stroke.lastX = worldPos.x;
      stroke.lastY = worldPos.y;

      const distToPet = Math.hypot(worldPos.x - pet.x, worldPos.y - pet.y);
      if (screenMoved >= 12 && distToPet <= 78 && moveDist > 0.5) {
        pet.interactionPauseTimer = Math.max(pet.interactionPauseTimer, 1.5);
        pet.vx = 0;
        pet.vy = 0;
        stroke.strokeAccum += moveDist;
        const nowMs = Date.now();
        if (pet.affinity >= 40) {
          pet.happyEyesTimer = Math.max(pet.happyEyesTimer, 0.9);
          if (nowMs - stroke.lastHeartAt >= 180) {
            stroke.lastHeartAt = nowMs;
            spawnHeartBurst(pet.x, pet.y - 16, 1);
          }
        }
        if (!stroke.didStroke && stroke.strokeAccum >= 32) {
          stroke.didStroke = true;
          setPetRadialMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
          performPetting('stroke');
        }
      }
      return;
    }

    if (
      worldPos &&
      !placingTypeRef.current &&
      !movingFurnitureIdRef.current &&
      !activeSeedRef.current
    ) {
      const hovered = findFurnitureAt(worldPos);
      hoveredFurnitureIdRef.current = hovered ? hovered.id : null;
      const hoveredPlot = findPlotAt(worldPos);
      hoveredPlotIdRef.current = hoveredPlot ? hoveredPlot.id : null;
      hoveredGateRef.current = isPointOnWorkGate(worldPos);
    } else if (worldPos && activeSeedRef.current) {
      const hoveredPlot = findPlotAt(worldPos);
      hoveredPlotIdRef.current = hoveredPlot ? hoveredPlot.id : null;
      hoveredFurnitureIdRef.current = null;
      hoveredGateRef.current = false;
    } else {
      hoveredFurnitureIdRef.current = null;
      hoveredPlotIdRef.current = null;
      hoveredGateRef.current = false;
    }

    const drag = dragStateRef.current;
    if (drag.active) {
      const dx = e.clientX - drag.startScreenX;
      const dy = e.clientY - drag.startScreenY;
      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        if (cameraRef.current.follow) {
          cameraRef.current.follow = false;
          setCameraFollowsPet(false);
        }
      }
      if (drag.moved) {
        const zoom = cameraRef.current.zoom;
        cameraRef.current.x = Math.max(
          120,
          Math.min(WORLD_WIDTH - 120, drag.startCamX - dx / zoom)
        );
        cameraRef.current.y = Math.max(
          100,
          Math.min(WORLD_HEIGHT - 100, drag.startCamY - dy / zoom)
        );
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = petStrokeRef.current;
    if (stroke.active) {
      stroke.active = false;
      e.stopPropagation();
      if (!stroke.didStroke) {
        const pet = petRef.current;
        if (pet.state === 'BROWSING' && pet.activeComputerActivity === 'sus') {
          soundFx.playCaught();
          pet.interactionPauseTimer = 0;
          pet.state = 'WANDERING';
          pet.activeComputerActivity = null;
          pet.targetFurnitureId = null;
          pet.computerCooldown = 28;
          pet.stateTimer = 2.0;
          pet.isLookingAtScreen = true;
          pet.bubbleText = 'AI!! Não era nada, juro!!';
          pet.bubbleKind = 'speech';
          pet.bubbleTimer = 4.2;
          lastSpokenBubbleRef.current = pet.bubbleText;
          pet.pendingDiaryEntry = true;
          pushPetMemory(
            pet,
            'O humano me flagrou vendo coisas suspeitas no computador e eu fechei tudo rápido!'
          );
          addFloatingNotice(pet.x, pet.y - 36, 'Flagra no PC!', '#DC2626');
          return;
        }

        // Pause movement while menu is open and record openedAtTimestamp for 300ms close guard
        pet.interactionPauseTimer = 5.0;
        pet.vx = 0;
        pet.vy = 0;
        pet.isLookingAtScreen = true;
        const screenPos = worldToScreen(pet.x, pet.y);
        if (screenPos) {
          setSelectedFurnitureId(null);
          setPetRadialMenu({
            open: true,
            screenX: screenPos.x,
            screenY: screenPos.y,
            openedAtTimestamp: Date.now(),
          });
        }
      }
      return;
    }

    const drag = dragStateRef.current;
    if (!drag.active) return;
    drag.active = false;

    if (!drag.moved) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      if (!worldPos) return;

      // 1. Catching or tapping pet (fallback if pet moved under cursor)
      if (isPointOnPet(worldPos)) {
        e.stopPropagation();
        const pet = petRef.current;
        if (pet.state === 'BROWSING' && pet.activeComputerActivity === 'sus') {
          soundFx.playCaught();
          pet.state = 'WANDERING';
          pet.activeComputerActivity = null;
          pet.targetFurnitureId = null;
          pet.computerCooldown = 28;
          pet.stateTimer = 2.0;
          pet.isLookingAtScreen = true;
          pet.bubbleText = 'AI!! Não era nada, juro!!';
          pet.bubbleKind = 'speech';
          pet.bubbleTimer = 4.2;
          lastSpokenBubbleRef.current = pet.bubbleText;
          pet.pendingDiaryEntry = true;
          pushPetMemory(
            pet,
            'O humano me flagrou vendo coisas suspeitas no computador e eu fechei tudo rápido!'
          );
          addFloatingNotice(pet.x, pet.y - 36, 'Flagra no PC!', '#DC2626');
          return;
        }

        pet.interactionPauseTimer = 5.0;
        pet.vx = 0;
        pet.vy = 0;
        pet.isLookingAtScreen = true;
        const screenPos = worldToScreen(pet.x, pet.y);
        if (screenPos) {
          setSelectedFurnitureId(null);
          setPetRadialMenu({
            open: true,
            screenX: screenPos.x,
            screenY: screenPos.y,
            openedAtTimestamp: Date.now(),
          });
        }
        return;
      }

      // 2. Clicking the Work Gate
      if (isPointOnWorkGate(worldPos)) {
        setWorkGateOpen(true);
        setSelectedFurnitureId(null);
        return;
      }

      // 3. Clicking a Garden Plot (Water or Harvest directly)
      const plot = findPlotAt(worldPos);
      if (plot) {
        if (plot.seed && plot.stage === 3) {
          const pet = petRef.current;
          pet.secondsWithoutAttention = 0;
          if (plot.seed === 'sunflower') {
            pet.inspiration = Math.min(100, pet.inspiration + 20);
            pet.mentalEnergy = Math.min(100, pet.mentalEnergy + 14);
            pet.bubbleText = 'Que girassol lindo você colheu!';
            addFloatingNotice(plot.x, plot.y - 26, '+20 Inspiração!', '#D97706');
          } else {
            const hungerGain = plot.seed === 'tomato' ? 35 : 30;
            const healthGain = plot.seed === 'tomato' ? 18 : 15;
            pet.hunger = Math.min(100, pet.hunger + hungerGain);
            pet.health = Math.min(100, pet.health + healthGain);
            pet.bubbleText = 'Colheita fresquinha da horta! Delícia!';
            soundFx.playEat();
            addFloatingNotice(
              plot.x,
              plot.y - 26,
              `+${hungerGain} Fome · +${healthGain} Saúde`,
              '#16A34A'
            );
          }
          pet.bubbleKind = 'speech';
          pet.bubbleTimer = 3.2;
          pet.pendingDiaryEntry = true;
          pushPetMemory(pet, 'Comemos algo fresquinho colhido na horta do quintal!');

          const updated = gardenPlotsRef.current.map((p) =>
            p.id === plot.id
              ? { ...p, seed: null, stage: 0 as const, watered: false, growthProgress: 0 }
              : p
          );
          gardenPlotsRef.current = updated;
          setGardenPlots(updated);
          return;
        }
        if (plot.seed && !plot.watered && plot.stage < 3) {
          petRef.current.secondsWithoutAttention = 0;
          const updated = gardenPlotsRef.current.map((p) =>
            p.id === plot.id ? { ...p, watered: true } : p
          );
          gardenPlotsRef.current = updated;
          setGardenPlots(updated);
          spawnParticleBurst(plot.x, plot.y - 6, 'water', 6);
          soundFx.playWater();
          addFloatingNotice(plot.x, plot.y - 24, 'Regado!', '#0284C7');
          return;
        }
        if (!plot.seed) {
          setShopOpen(true);
          return;
        }
      }

      // 4. Clicking the Pond (refreshing splash / bath)
      const pondNorm =
        ((worldPos.x - 1142.5) / 86) ** 2 + ((worldPos.y - 262.5) / 66) ** 2;
      if (pondNorm <= 1) {
        spawnParticleBurst(worldPos.x, worldPos.y, 'water', 7);
        soundFx.playWater();
        const nowMs = Date.now();
        const pet = petRef.current;
        if (pet.state !== 'WORKING' && nowMs - lastPondSplashAtRef.current >= 15000) {
          lastPondSplashAtRef.current = nowMs;
          pet.secondsWithoutAttention = 0;
          pet.health = Math.min(100, pet.health + 6);
          pet.happyEyesTimer = 1.6;
          spawnParticleBurst(pet.x, pet.y - 10, 'water', 5);
          addFloatingNotice(worldPos.x, worldPos.y - 18, 'Banho refrescante! +6 Saúde', '#0284C7');
          setHudStats((prev) => ({ ...prev, health: pet.health }));
        } else {
          addFloatingNotice(worldPos.x, worldPos.y - 16, 'Splash!', '#0284C7');
        }
        setSelectedFurnitureId(null);
        return;
      }

      // 5. Clicking placed furniture
      const hit = findFurnitureAt(worldPos);
      if (hit) {
        setSelectedFurnitureId(hit.id);
        if (hit.type === 'diary') {
          handleOpenDiaryModal(hit.id);
        }
      } else {
        setSelectedFurnitureId(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const nextZoom = Math.max(0.68, Math.min(1.65, cameraRef.current.zoom + delta));
    cameraRef.current.zoom = nextZoom;
  };

  const handleCenterOnPet = () => {
    cameraRef.current.follow = true;
    setCameraFollowsPet(true);
  };

  const handleChangePetName = (newName: string) => {
    petRef.current.name = newName;
    setHudStats((prev) => ({ ...prev, name: newName }));
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFx.setMuted(next);
  };

  const handleOpenGallery = () => {
    setHasUnreadGallery(false);
    setGalleryOpen(true);
  };

  const selectedFurniture = furniture.find((f) => f.id === selectedFurnitureId) ?? null;
  const hasFridge = furniture.some((f) => f.type === 'fridge');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1E1A16]">
      <TopHud
        petName={hudStats.name}
        onChangePetName={handleChangePetName}
        coins={coins}
        hunger={hudStats.hunger}
        energy={hudStats.energy}
        mentalEnergy={hudStats.mentalEnergy}
        health={hudStats.health}
        inspiration={hudStats.inspiration}
        timeOfDay={timeOfDay}
        weather={weather}
        onCycleWeather={handleCycleWeather}
        clockText={clockText}
        timeScale={timeScale}
        onChangeTimeScale={setTimeScale}
        galleryTotalCount={artworks.length + discoveries.length}
        hasUnreadGallery={hasUnreadGallery}
        onOpenGallery={handleOpenGallery}
        onOpenCreator={() => setCreatorState({ open: true, canCancel: true })}
        onOpenApiKeySettings={() => setApiKeyModalState({ open: true, canClose: true })}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isCollapsed={topCollapsed}
        onToggleCollapse={() => setTopCollapsed((c) => !c)}
      />

      <PetRadialMenu
        isOpen={petRadialMenu.open}
        openedAtTimestamp={petRadialMenu.openedAtTimestamp}
        petName={hudStats.name}
        screenX={petRadialMenu.screenX}
        screenY={petRadialMenu.screenY}
        isGrumpy={hudStats.affinity < 40}
        lastPetTime={lastPetTime}
        lastPraiseTime={lastPraiseTime}
        petCooldownMs={SOCIAL_COOLDOWN_MS}
        praiseCooldownMs={
          hudStats.affinity < 40 ? PRAISE_GRUMPY_COOLDOWN_MS : SOCIAL_COOLDOWN_MS
        }
        onPet={() => {
          setPetRadialMenu((prev) => ({ ...prev, open: false }));
          performPetting('menu');
        }}
        onPraise={() => {
          setPetRadialMenu((prev) => ({ ...prev, open: false }));
          performPraise();
        }}
        onChat={() => {
          setPetRadialMenu((prev) => ({ ...prev, open: false }));
          setChatOpen(true);
        }}
        onClose={() => setPetRadialMenu((prev) => ({ ...prev, open: false }))}
      />

      {offlineNotice && (
        <div
          role="status"
          className="fixed top-24 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-md bg-[#FAF7F2]/96 backdrop-blur-md border border-[#DFD5C5] text-[#2B2520] rounded-2xl px-4 py-3.5 shadow-xl flex items-start gap-3 text-xs"
        >
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold text-sm text-[#2B2520]">
                Enquanto você estava fora ({offlineNotice.hoursAway}h)
              </span>
              {offlineNotice.affinityLoss > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold text-[11px] tabular-nums">
                  -{offlineNotice.affinityLoss} Afinidade
                </span>
              )}
            </div>
            <p className="text-[#5C5044] leading-relaxed">{offlineNotice.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => setOfflineNotice(null)}
            className="px-2.5 py-1.5 rounded-xl bg-[#2B2520] text-[#FAF7F2] font-semibold hover:bg-[#3D352E] cursor-pointer shrink-0"
          >
            Entendi
          </button>
        </div>
      )}

      {apiErrorBanner && (
        <div
          role="alert"
          className="fixed top-24 right-3 z-[55] max-w-xs sm:max-w-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3 text-xs"
        >
          <div className="flex-1 leading-relaxed">{apiErrorBanner}</div>
          <button
            type="button"
            onClick={() => setApiErrorBanner(null)}
            className="text-rose-700 font-semibold hover:underline cursor-pointer shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          hoverWorldRef.current = null;
          hoveredFurnitureIdRef.current = null;
          hoveredPlotIdRef.current = null;
          hoveredGateRef.current = false;
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          cancelPlacementOrSeed();
        }}
        onWheel={handleWheel}
        className={`w-full h-full block touch-none ${
          placingType || movingFurnitureId || activeSeedToPlant
            ? 'cursor-crosshair'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      <ChatDrawer
        isOpen={chatOpen}
        onToggleOpen={() => setChatOpen((o) => !o)}
        petName={hudStats.name}
        mood={hudStats.mood}
        affinity={hudStats.affinity}
        traits={hudStats.traits}
        socialBattery={socialBattery.energy}
        socialBatteryMax={SOCIAL_BATTERY_MAX}
        socialBatteryNextRechargeMs={socialBattery.nextRechargeMs}
        messages={chatMessages}
        isSending={chatSending}
        errorMessage={chatError}
        onDismissError={() => setChatError(null)}
        onSendMessage={handleSendChatMessage}
        bottomBarCollapsed={bottomCollapsed}
      />

      <InventoryBar
        coins={coins}
        placingType={placingType}
        movingFurnitureId={movingFurnitureId}
        activeSeedToPlant={activeSeedToPlant}
        onCancelPlacementOrSeed={cancelPlacementOrSeed}
        selectedFurniture={selectedFurniture}
        onStartMoveFurniture={(id) => {
          cancelPlacementOrSeed();
          setMovingFurnitureId(id);
          setSelectedFurnitureId(null);
        }}
        onFeedFromFridge={(id) => handleFeedFromFridge(id)}
        onRefillFridgePaid={(id) => handleRefillFridgePaid(id)}
        onOpenDiary={handleOpenDiaryModal}
        onOpenPenaltyGame={() => setPenaltyOpen(true)}
        onRemoveFurniture={handleRemoveFurniture}
        onClearSelection={() => setSelectedFurnitureId(null)}
        onOpenShop={() => setShopOpen(true)}
        onOpenWorkGate={() => setWorkGateOpen(true)}
        cameraFollowsPet={cameraFollowsPet}
        onCenterOnPet={handleCenterOnPet}
        isCollapsed={bottomCollapsed}
        onToggleCollapse={() => setBottomCollapsed((c) => !c)}
      />

      <ApiKeyModal
        isOpen={apiKeyModalState.open}
        canClose={apiKeyModalState.canClose || creatorState.open || hasConfiguredApiKey()}
        onClose={() => setApiKeyModalState((prev) => ({ ...prev, open: false }))}
        onSaved={() => {
          setApiErrorBanner(null);
          setApiKeyModalState({ open: false, canClose: true });
        }}
        onCleared={() => {
          if (!hasConfiguredApiKey() && !creatorState.open) {
            setApiKeyModalState({ open: true, canClose: false });
          }
        }}
      />

      <CompanionCreatorModal
        isOpen={creatorState.open}
        canCancel={creatorState.canCancel}
        onCancel={() => setCreatorState((prev) => ({ ...prev, open: false }))}
        onOpenApiKeySettings={() => setApiKeyModalState({ open: true, canClose: true })}
        socialBattery={socialBattery.energy}
        socialBatteryNextRechargeMs={socialBattery.nextRechargeMs}
        onConsumeSocialBattery={handleConsumeSocialBattery}
        onConfirmCompanion={handleConfirmCompanion}
      />

      <ShopModal
        isOpen={shopOpen}
        onClose={() => setShopOpen(false)}
        coins={coins}
        hasFridge={hasFridge}
        onBuyFurniture={handleBuyFurniture}
        onBuyRefill={handleBuyRefill}
        onBuyTreat={handleBuyTreat}
        onBuySeed={handleBuySeed}
      />

      <WorkGateModal
        isOpen={workGateOpen}
        onClose={() => setWorkGateOpen(false)}
        petName={hudStats.name}
        hunger={hudStats.hunger}
        energy={hudStats.energy}
        affinity={hudStats.affinity}
        isAlreadyWorking={hudStats.state === 'WORKING'}
        workCount={hudStats.workCount}
        traits={hudStats.traits}
        onSelectGig={handleSelectWorkGig}
      />

      <PenaltyMinigameModal
        isOpen={penaltyOpen}
        petName={hudStats.name}
        appearance={petRef.current.appearance}
        onClose={() => setPenaltyOpen(false)}
        onComplete={handlePenaltyComplete}
      />

      <ArtGalleryModal
        isOpen={galleryOpen}
        initialTab={galleryTab}
        onClose={() => setGalleryOpen(false)}
        artworks={artworks}
        discoveries={discoveries}
        petName={hudStats.name}
        onDeleteArtwork={(id) => setArtworks((prev) => prev.filter((a) => a.id !== id))}
        onDeleteDiscovery={(id) => setDiscoveries((prev) => prev.filter((d) => d.id !== id))}
      />

      <DiaryModal
        isOpen={diaryModal.open}
        phase={diaryModal.phase}
        petName={hudStats.name}
        affinity={hudStats.affinity}
        entries={diaryEntries}
        onClose={() => setDiaryModal((prev) => ({ ...prev, open: false }))}
        onAskPermission={handleAskDiaryPermission}
        onSneakRead={handleSneakReadDiary}
      />
    </div>
  );
}
