export type FurnitureType =
  | 'fridge'
  | 'mat'
  | 'bed'
  | 'easel'
  | 'computer'
  | 'diary'
  | 'ball';

export type TimeOfDay = 'day' | 'dusk' | 'night';

export type WeatherType = 'sunny' | 'cloudy' | 'rainy';

export type PetStatusState =
  | 'WANDERING'
  | 'WALKING_TO_OBJECT'
  | 'EATING'
  | 'HUNGRY_COMPLAINT'
  | 'SLEEPING'
  | 'INSPIRING'
  | 'PAINTING'
  | 'BROWSING'
  | 'WRITING_DIARY'
  | 'PLAYING_BALL'
  | 'HARVESTING_GARDEN'
  | 'WORKING'
  | 'CALLING_PLAYER';

export type ComputerActivity = 'gaming' | 'videos' | 'research' | 'sus';

export type SeedType = 'carrot' | 'tomato' | 'sunflower';

export interface GardenPlot {
  id: string;
  x: number;
  y: number;
  seed: SeedType | null;
  stage: 0 | 1 | 2 | 3;
  watered: boolean;
  growthProgress: number;
}

export type TraitKey =
  | 'curioso'
  | 'nerd'
  | 'filosofo'
  | 'artistico'
  | 'carinhoso'
  | 'trabalhador'
  | 'preguicoso';

export interface PetTraits {
  curioso: number;
  nerd: number;
  filosofo: number;
  artistico: number;
  carinhoso: number;
  trabalhador: number;
  preguicoso: number;
}

export type BodyShape = 'round' | 'chubby' | 'tall' | 'boxy';
export type EarStyle = 'cat' | 'floppy' | 'antenna' | 'horns' | 'none';
export type EyeStyle = 'round' | 'sleepy' | 'sparkle' | 'visor';
export type AccessoryStyle = 'none' | 'scarf' | 'bow' | 'crown' | 'glasses' | 'bolt';

export interface PetAppearance {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bodyShape: BodyShape;
  earStyle: EarStyle;
  eyeStyle: EyeStyle;
  accessory: AccessoryStyle;
  descriptionPrompt?: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type LeisureActivityKey = 'easel' | 'computer' | 'ball' | 'diary' | 'garden';

export interface PlacedFurniture {
  id: string;
  type: FurnitureType;
  x: number;
  y: number;
  foodStock: number;
  maxFoodStock: number;
  /** 0..1 temporary novelty boost when newly placed on the map */
  noveltyBoost?: number;
}

export interface PetState {
  name: string;
  appearance: PetAppearance;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lookX: number;
  lookY: number;
  /** 0..100 where 100 is full and < 35 triggers hunger seeking */
  hunger: number;
  /** 0..100 where 100 is rested and < 30 triggers sleep seeking */
  energy: number;
  /** 0..100 mental energy consumed by painting, browsing, and writing diary */
  mentalEnergy: number;
  /** 0..100 physical health affected by sedentary habits vs exercise/natural food */
  health: number;
  /** 0..100 creative inspiration / happiness gauge */
  inspiration: number;
  /** 0..100 internal boredom */
  boredom: number;
  /** 0..100 player-pet affinity */
  affinity: number;
  traits: PetTraits;
  workCount: number;
  activeComputerActivity: ComputerActivity | null;
  activeWorkReward: number;
  activeWorkLabel: string | null;
  targetPlotId: string | null;
  /** Seconds remaining while grumpy after being caught or neglected */
  grumpyTimer: number;
  /** Seconds remaining with happy closed eyes during petting/praise */
  happyEyesTimer: number;
  /** Seconds remaining where pet movement is paused for direct interaction */
  interactionPauseTimer: number;
  /** Cooldown before pet proactively walks up to seek affection again */
  affectionSeekCooldown: number;
  /** Short rolling memory log of recent events for chat & diary */
  recentEvents: string[];
  /** Compact evolutionary long-term memory summary (up to 400 chars) */
  longTermMemory: string;
  /** Timestamp (ms) of last persisted activity */
  lastActiveAt?: number;
  state: PetStatusState;
  stateTimer: number;
  targetFurnitureId: string | null;
  path: Vec2[];
  bubbleText: string | null;
  bubbleKind: 'speech' | 'thought' | 'icon';
  bubbleTimer: number;
  isLookingAtScreen: boolean;
  blinkTimer: number;
  isBlinking: boolean;
  walkCycle: number;
  paintCooldown: number;
  computerCooldown: number;
  diaryCooldown: number;
  ballCooldown: number;
  workCooldown: number;
  pendingDiaryEntry: boolean;
  secondsWithoutAttention: number;
  lastUsedActivityType: LeisureActivityKey | null;
  consecutiveUseCount: number;
  satiationMap: Partial<Record<LeisureActivityKey, number>>;
}

export interface ArtworkEntry {
  id: string;
  title: string;
  explanation: string;
  svg: string;
  mood: string;
  timeOfDay: TimeOfDay;
  createdAt: number;
}

export interface DiscoveryEntry {
  id: string;
  topic: string;
  learned: string;
  traitKey: TraitKey;
  traitDelta: number;
  mood: string;
  createdAt: number;
}

export interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  mood: string;
  affinityAtTime: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'pet';
  text: string;
  createdAt: number;
}

export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ZoneArea {
  id: string;
  label: string;
  floor: 'wood-warm' | 'wood-cozy' | 'tile-kitchen' | 'grass';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FurnitureCatalogItem {
  type: FurnitureType;
  name: string;
  shortName: string;
  description: string;
  radius: number;
  price: number;
}

export interface WorkGig {
  id: string;
  title: string;
  durationSec: number;
  rewardCoins: number;
  energyCost: number;
  mentalCost: number;
  healthDelta: number;
  traitBoost: TraitKey;
}
