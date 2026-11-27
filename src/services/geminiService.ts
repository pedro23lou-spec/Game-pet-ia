import { GoogleGenAI, Type, type GenerateContentConfig } from '@google/genai';
import type {
  ChatMessage,
  PetAppearance,
  PetTraits,
  TimeOfDay,
  TraitKey,
  WeatherType,
} from '../types/game';
import { containsProxyDisabled, safeFetchJson } from '../utils/safeFetch';

export const isProxyDisabledError = containsProxyDisabled;

export const USER_GEMINI_API_KEY_STORAGE = 'user_gemini_api_key';

const CLIENT_PRIMARY_MODEL = 'gemini-2.5-flash';
const CLIENT_FALLBACK_MODEL = 'gemini-2.0-flash';

export type GeminiApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; code?: string };

let cachedServerKeyAvailable: boolean | null = null;

const ALLOWED_TIME_LABELS: Record<string, string> = {
  day: 'dia ensolarado',
  dusk: 'entardecer dourado',
  night: 'noite aconchegante',
};

const ALLOWED_WEATHER_LABELS: Record<string, string> = {
  sunny: 'ensolarado e agradável',
  cloudy: 'nublado com nuvens passando',
  rainy: 'chuvoso lá fora no quintal',
};

const VALID_TRAITS: readonly TraitKey[] = [
  'curioso',
  'nerd',
  'filosofo',
  'artistico',
  'carinhoso',
  'trabalhador',
  'preguicoso',
];

const BODY_SHAPES = ['round', 'chubby', 'tall', 'boxy'] as const;
const EAR_STYLES = ['cat', 'floppy', 'antenna', 'horns', 'none'] as const;
const EYE_STYLES = ['round', 'sleepy', 'sparkle', 'visor'] as const;
const ACCESSORY_STYLES = ['none', 'scarf', 'bow', 'crown', 'glasses', 'bolt'] as const;

export function getStoredUserApiKey(): string {
  try {
    const val = localStorage.getItem(USER_GEMINI_API_KEY_STORAGE);
    return typeof val === 'string' ? val.trim() : '';
  } catch {
    return '';
  }
}

export function saveUserApiKey(key: string): void {
  const cleaned = key.trim();
  try {
    if (cleaned) {
      localStorage.setItem(USER_GEMINI_API_KEY_STORAGE, cleaned);
    } else {
      localStorage.removeItem(USER_GEMINI_API_KEY_STORAGE);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearUserApiKey(): void {
  try {
    localStorage.removeItem(USER_GEMINI_API_KEY_STORAGE);
  } catch {
    // Ignore storage errors
  }
}

export function hasLocalUserApiKey(): boolean {
  return Boolean(getStoredUserApiKey());
}

/**
 * Creates a direct browser-side GoogleGenAI client when the user has saved their own API key
 * in localStorage (`user_gemini_api_key`). Returns null when running via server/preview fallback.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const userKey = getStoredUserApiKey();
  if (!userKey) return null;
  return new GoogleGenAI({ apiKey: userKey });
}

export async function detectServerGeminiHealth(forceRefresh = false): Promise<boolean> {
  if (!forceRefresh && cachedServerKeyAvailable !== null) {
    return cachedServerKeyAvailable;
  }
  const res = await safeFetchJson<{ ok?: boolean; hasServerKey?: boolean }>('/api/health');
  const available = Boolean(res.ok && res.data.hasServerKey);
  cachedServerKeyAvailable = available;
  return available;
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.round(Math.max(min, Math.min(max, val)));
}

function safeStr(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : fallback;
}

function safeHexColor(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function safeStrArray(val: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxItemLen))
    .slice(0, maxItems);
}

function sanitizeTraits(raw: unknown): PetTraits {
  const base: PetTraits = {
    curioso: 20,
    nerd: 15,
    filosofo: 15,
    artistico: 20,
    carinhoso: 25,
    trabalhador: 15,
    preguicoso: 15,
  };
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of VALID_TRAITS) {
      base[key] = clampNum(obj[key], 0, 100, base[key]);
    }
  }
  return base;
}

function sanitizeSvgMarkup(rawSvg: string): string {
  const trimmed = rawSvg.trim();
  const svgMatch = trimmed.match(/<svg[\s\S]*<\/svg>/i);
  if (!svgMatch) {
    throw new Error('O modelo não retornou um código SVG válido.');
  }

  let svg = svgMatch[0];
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

  if (!/viewBox\s*=/i.test(svg.slice(0, svg.indexOf('>') + 1))) {
    svg = svg.replace(/<svg/i, '<svg viewBox="0 0 200 200"');
  }

  return svg;
}

function parseJsonResponse<T>(rawText: string): T {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { status?: unknown; message?: unknown };
  if (errObj.status === 429) return true;
  const msg = typeof errObj.message === 'string' ? errObj.message : String(error);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('rate-limit')
  );
}

function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { status?: unknown; message?: unknown };
  if (errObj.status === 401 || errObj.status === 403) return true;
  const msg = typeof errObj.message === 'string' ? errObj.message : String(error);
  return (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('PERMISSION_DENIED')
  );
}

function shouldFallbackClientModel(error: unknown): boolean {
  if (isAuthError(error)) return false;
  if (isQuotaError(error)) return true;
  if (!error || typeof error !== 'object') return true;
  const errObj = error as { status?: unknown; message?: unknown };
  if (errObj.status === 404 || errObj.status === 503 || errObj.status === 500) return true;
  const msg = (typeof errObj.message === 'string' ? errObj.message : String(error)).toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('not supported') ||
    msg.includes('503')
  );
}

function formatClientGeminiError<T>(error: unknown): GeminiApiResult<T> {
  if (containsProxyDisabled(error)) {
    return {
      ok: false,
      status: 503,
      code: 'PROXY_GENERATION_DISABLED',
      error: '',
    };
  }
  if (isQuotaError(error)) {
    return {
      ok: false,
      status: 429,
      code: 'QUOTA_EXCEEDED',
      error:
        'Limite gratuito da sua chave Gemini atingido no momento. Aguarde alguns instantes e tente novamente.',
    };
  }
  if (isAuthError(error)) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_API_KEY',
      error: 'A chave da API Gemini salva parece inválida. Confira na engrenagem (⚙️).',
    };
  }
  return {
    ok: false,
    status: 502,
    error: 'Não foi possível obter resposta da API Gemini agora. Tente novamente em instantes.',
  };
}

async function generateDirectWithFallback(
  ai: GoogleGenAI,
  contents: string,
  config: GenerateContentConfig
) {
  try {
    return await ai.models.generateContent({
      model: CLIENT_PRIMARY_MODEL,
      contents,
      config,
    });
  } catch (err) {
    if (!shouldFallbackClientModel(err)) {
      throw err;
    }
    const fallbackConfig: GenerateContentConfig = { ...config };
    delete fallbackConfig.thinkingConfig;
    return await ai.models.generateContent({
      model: CLIENT_FALLBACK_MODEL,
      contents,
      config: fallbackConfig,
    });
  }
}

function getNoServerFallbackError<T>(): GeminiApiResult<T> | null {
  if (cachedServerKeyAvailable === false) {
    return {
      ok: false,
      status: 401,
      code: 'NO_API_KEY',
      error: 'Conecte sua chave gratuita do Google AI Studio na engrenagem (⚙️) para continuar.',
    };
  }
  return null;
}

export async function createPetAppearance(payload: {
  petName: string;
  description: string;
}): Promise<
  GeminiApiResult<{
    appearance: PetAppearance;
    traits: PetTraits;
    tagline: string;
  }>
> {
  const ai = getGeminiClient();
  if (!ai) {
    const noKeyErr = getNoServerFallbackError<{
      appearance: PetAppearance;
      traits: PetTraits;
      tagline: string;
    }>();
    if (noKeyErr) return noKeyErr;
    return safeFetchJson('/api/pet/create-appearance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const petName = safeStr(payload.petName, 24, 'Pipoca');
  const description = safeStr(
    payload.description,
    240,
    'um bichinho fofo e curioso cor de caramelo'
  );

  const prompt = [
    `Você está criando a aparência 2D e personalidade inicial de um virtual pet chamado "${petName}".`,
    `Descrição desejada pelo jogador: "${description}"`,
    '',
    `Retorne um JSON definindo os parâmetros visuais exatos para desenhar esse personagem no Canvas 2D:`,
    `- primaryColor: cor hex #RRGGBB do corpo principal (ex: "#2B2830" para gato preto, "#8B5CF6" para alienígena roxo, "#94A3B8" para robô).`,
    `- secondaryColor: cor hex #RRGGBB de orelhas/detalhes/barriga que harmonize com primaryColor.`,
    `- accentColor: cor hex #RRGGBB para acessório/bochechas/detalhes.`,
    `- bodyShape: um destes exatos -> "round", "chubby", "tall", "boxy" (use "boxy" para robôs, "chubby" para criaturas fofinhas, "tall" para alienígenas esguios, "round" para gatos/criaturas clássicas).`,
    `- earStyle: um destes exatos -> "cat", "floppy", "antenna", "horns", "none".`,
    `- eyeStyle: um destes exatos -> "round", "sleepy", "sparkle", "visor" (use "visor" para robôs, "sleepy" para rabugentos/preguiçosos, "sparkle" para curiosos/mágicos).`,
    `- accessory: um destes exatos -> "none", "scarf", "bow", "crown", "glasses", "bolt".`,
    `- traits: valores iniciais de 5 a 45 para curioso, nerd, filosofo, artistico, carinhoso, trabalhador, preguicoso que combinem com a descrição.`,
    `- tagline: uma frase curta de apresentação do pet em primeira pessoa (português do Brasil).`,
  ].join('\n');

  try {
    const response = await generateDirectWithFallback(ai, prompt, {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryColor: { type: Type.STRING },
          secondaryColor: { type: Type.STRING },
          accentColor: { type: Type.STRING },
          bodyShape: { type: Type.STRING },
          earStyle: { type: Type.STRING },
          eyeStyle: { type: Type.STRING },
          accessory: { type: Type.STRING },
          tagline: { type: Type.STRING },
          traits: {
            type: Type.OBJECT,
            properties: {
              curioso: { type: Type.INTEGER },
              nerd: { type: Type.INTEGER },
              filosofo: { type: Type.INTEGER },
              artistico: { type: Type.INTEGER },
              carinhoso: { type: Type.INTEGER },
              trabalhador: { type: Type.INTEGER },
              preguicoso: { type: Type.INTEGER },
            },
            required: [
              'curioso',
              'nerd',
              'filosofo',
              'artistico',
              'carinhoso',
              'trabalhador',
              'preguicoso',
            ],
          },
        },
        required: [
          'primaryColor',
          'secondaryColor',
          'accentColor',
          'bodyShape',
          'earStyle',
          'eyeStyle',
          'accessory',
          'tagline',
          'traits',
        ],
      },
    });

    const parsed = parseJsonResponse<Record<string, unknown>>(response.text ?? '');
    const bodyShape = BODY_SHAPES.includes(parsed.bodyShape as (typeof BODY_SHAPES)[number])
      ? (parsed.bodyShape as (typeof BODY_SHAPES)[number])
      : 'round';
    const earStyle = EAR_STYLES.includes(parsed.earStyle as (typeof EAR_STYLES)[number])
      ? (parsed.earStyle as (typeof EAR_STYLES)[number])
      : 'cat';
    const eyeStyle = EYE_STYLES.includes(parsed.eyeStyle as (typeof EYE_STYLES)[number])
      ? (parsed.eyeStyle as (typeof EYE_STYLES)[number])
      : 'round';
    const accessory = ACCESSORY_STYLES.includes(
      parsed.accessory as (typeof ACCESSORY_STYLES)[number]
    )
      ? (parsed.accessory as (typeof ACCESSORY_STYLES)[number])
      : 'none';

    return {
      ok: true,
      data: {
        appearance: {
          primaryColor: safeHexColor(parsed.primaryColor, '#FFE3BF'),
          secondaryColor: safeHexColor(parsed.secondaryColor, '#FFF5E6'),
          accentColor: safeHexColor(parsed.accentColor, '#E07A5F'),
          bodyShape,
          earStyle,
          eyeStyle,
          accessory,
          descriptionPrompt: description,
        },
        traits: sanitizeTraits(parsed.traits),
        tagline: safeStr(parsed.tagline, 140, `Oi! Eu sou ${petName}, pronto para explorar!`),
      },
    };
  } catch (error) {
    return formatClientGeminiError(error);
  }
}

export async function paintPetArtwork(payload: {
  petName: string;
  mood: string;
  timeOfDay: TimeOfDay;
  hunger: number;
  energy: number;
  inspiration: number;
  nearbyObjects: string[];
  previousTitles: string[];
}): Promise<GeminiApiResult<{ title?: string; explanation?: string; svg?: string }>> {
  const ai = getGeminiClient();
  if (!ai) {
    const noKeyErr = getNoServerFallbackError<{
      title?: string;
      explanation?: string;
      svg?: string;
    }>();
    if (noKeyErr) return noKeyErr;
    return safeFetchJson('/api/pet/paint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const petName = safeStr(payload.petName, 32, 'Pipoca');
  const mood = safeStr(payload.mood, 60, 'curioso e feliz');
  const timeLabel = ALLOWED_TIME_LABELS[payload.timeOfDay] ?? 'dia ensolarado';
  const hunger = clampNum(payload.hunger, 0, 100, 75);
  const energy = clampNum(payload.energy, 0, 100, 75);
  const inspiration = clampNum(payload.inspiration, 0, 100, 85);
  const nearbyObjects = safeStrArray(payload.nearbyObjects, 8, 40);
  const previousTitles = safeStrArray(payload.previousTitles, 6, 80);

  const prompt = [
    `Você é ${petName}, um bichinho virtual fofo, expressivo e criativo que acabou de ir até seu cavalete de pintura para criar um quadro.`,
    `Contexto atual do pet:`,
    `- Humor atual: ${mood}`,
    `- Momento do dia lá fora: ${timeLabel}`,
    `- Saciedade (fome): ${hunger}% | Energia: ${energy}% | Inspiração: ${inspiration}%`,
    nearbyObjects.length > 0
      ? `- Objetos na casa que você observa: ${nearbyObjects.join(', ')}`
      : `- A casa está bem minimalista hoje.`,
    previousTitles.length > 0
      ? `- Títulos de quadros que você já pintou antes (crie algo diferente!): ${previousTitles.join('; ')}`
      : '',
    '',
    `Crie uma obra de arte original em SVG colorido e encantador que reflita sua personalidade e humor atual.`,
    `Regras obrigatórias para o SVG:`,
    `- Deve começar com <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"> e terminar com </svg>.`,
    `- Use de 8 a 28 formas geométricas simples e bem compostas (<rect>, <circle>, <ellipse>, <polygon>, <polyline>, <path>, <line>) com um fundo colorido cobrindo todo o quadro 200x200.`,
    `- Escolha uma paleta harmônica e vibrante, com camadas e detalhes bonitos.`,
    `- NÃO use <script>, <image>, <foreignObject> ou links externos.`,
    `- Escreva o título e a frase explicativa em português do Brasil natural, fofo e em primeira pessoa.`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await generateDirectWithFallback(ai, prompt, {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          svg: { type: Type.STRING },
        },
        required: ['title', 'explanation', 'svg'],
      },
    });

    const parsed = parseJsonResponse<{
      title?: string;
      explanation?: string;
      svg?: string;
    }>(response.text ?? '');

    if (!parsed.title || !parsed.explanation || !parsed.svg) {
      return {
        ok: false,
        status: 502,
        error: 'Formato incompleto retornado pelo modelo Gemini.',
      };
    }

    const cleanSvg = sanitizeSvgMarkup(parsed.svg);
    return {
      ok: true,
      data: {
        title: parsed.title.trim().slice(0, 80),
        explanation: parsed.explanation.trim().slice(0, 240),
        svg: cleanSvg,
      },
    };
  } catch (error) {
    return formatClientGeminiError(error);
  }
}

export async function discoverPetKnowledge(payload: {
  petName: string;
  mood: string;
  traits: PetTraits;
  previousTopics: string[];
}): Promise<
  GeminiApiResult<{
    topic?: string;
    learned?: string;
    traitKey?: TraitKey;
    traitDelta?: number;
  }>
> {
  const ai = getGeminiClient();
  if (!ai) {
    const noKeyErr = getNoServerFallbackError<{
      topic?: string;
      learned?: string;
      traitKey?: TraitKey;
      traitDelta?: number;
    }>();
    if (noKeyErr) return noKeyErr;
    return safeFetchJson('/api/pet/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const petName = safeStr(payload.petName, 32, 'Pipoca');
  const mood = safeStr(payload.mood, 60, 'curioso');
  const traits = sanitizeTraits(payload.traits);
  const previousTopics = safeStrArray(payload.previousTopics, 8, 80);

  const prompt = [
    `Você é ${petName}, um bichinho virtual fofo que acabou de usar o computador da casa para pesquisar na internet sozinho.`,
    `Humor atual: ${mood}`,
    `Traços atuais: curioso=${traits.curioso}, nerd=${traits.nerd}, filosofo=${traits.filosofo}, artistico=${traits.artistico}, carinhoso=${traits.carinhoso}.`,
    previousTopics.length > 0
      ? `Temas já pesquisados antes (escolha algo diferente): ${previousTopics.join('; ')}`
      : '',
    '',
    `Invente uma pesquisa espontânea fascinante e real sobre curiosidades do espaço, animais, ciência, natureza, música, história ou filosofia.`,
    `Conte o que você aprendeu em português do Brasil com a sua voz de pet empolgado (2 a 3 frases curtas).`,
    `Escolha um traço estimulado ("curioso", "nerd", "filosofo", "artistico" ou "carinhoso") e um ganho inteiro entre 2 e 5.`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await generateDirectWithFallback(ai, prompt, {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          learned: { type: Type.STRING },
          traitKey: { type: Type.STRING },
          traitDelta: { type: Type.INTEGER },
        },
        required: ['topic', 'learned', 'traitKey', 'traitDelta'],
      },
    });

    const parsed = parseJsonResponse<{
      topic?: string;
      learned?: string;
      traitKey?: string;
      traitDelta?: number;
    }>(response.text ?? '');

    if (!parsed.topic || !parsed.learned) {
      return {
        ok: false,
        status: 502,
        error: 'Resposta incompleta ao gerar descoberta.',
      };
    }

    const allowedDiscTraits = ['curioso', 'nerd', 'filosofo', 'artistico', 'carinhoso'] as const;
    const traitKey = allowedDiscTraits.includes(
      parsed.traitKey as (typeof allowedDiscTraits)[number]
    )
      ? (parsed.traitKey as (typeof allowedDiscTraits)[number])
      : 'curioso';
    const traitDelta = clampNum(parsed.traitDelta, 1, 6, 3);

    return {
      ok: true,
      data: {
        topic: parsed.topic.trim().slice(0, 90),
        learned: parsed.learned.trim().slice(0, 420),
        traitKey,
        traitDelta,
      },
    };
  } catch (error) {
    return formatClientGeminiError(error);
  }
}

export async function writePetDiary(payload: {
  petName: string;
  mood: string;
  affinity: number;
  hunger: number;
  energy: number;
  health: number;
  traits: PetTraits;
  timeOfDay: TimeOfDay;
  weather?: WeatherType;
  recentEvents: string[];
  lastArtwork: string;
  lastDiscovery: string;
}): Promise<GeminiApiResult<{ title?: string; content?: string }>> {
  const ai = getGeminiClient();
  if (!ai) {
    const noKeyErr = getNoServerFallbackError<{ title?: string; content?: string }>();
    if (noKeyErr) return noKeyErr;
    return safeFetchJson('/api/pet/diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const petName = safeStr(payload.petName, 32, 'Pipoca');
  const mood = safeStr(payload.mood, 60, 'reflexivo');
  const affinity = clampNum(payload.affinity, 0, 100, 50);
  const hunger = clampNum(payload.hunger, 0, 100, 75);
  const energy = clampNum(payload.energy, 0, 100, 75);
  const health = clampNum(payload.health, 0, 100, 85);
  const traits = sanitizeTraits(payload.traits);
  const timeLabel = ALLOWED_TIME_LABELS[payload.timeOfDay] ?? 'dia';
  const weatherLabel = ALLOWED_WEATHER_LABELS[payload.weather ?? 'sunny'] ?? 'ensolarado';
  const recentEvents = safeStrArray(payload.recentEvents, 6, 120);
  const lastArtwork = safeStr(payload.lastArtwork, 120);
  const lastDiscovery = safeStr(payload.lastDiscovery, 120);

  const prompt = [
    `Você é ${petName}, escrevendo escondido no seu Diário Secreto pessoal.`,
    `Seja sincero, emotivo, engraçado ou desconfiado de acordo com o que aconteceu:`,
    `- Afinidade com o humano: ${affinity}/100 | Humor: ${mood}`,
    `- Fome: ${hunger}% | Energia: ${energy}% | Saúde: ${health}% | Momento: ${timeLabel} | Clima: ${weatherLabel}`,
    `- Traços: trabalhador=${traits.trabalhador}, preguicoso=${traits.preguicoso}, curioso=${traits.curioso}, carinhoso=${traits.carinhoso}`,
    lastArtwork ? `- Pintou recentemente: ${lastArtwork}` : '',
    lastDiscovery ? `- Descobriu na internet: ${lastDiscovery}` : '',
    recentEvents.length > 0
      ? `- Eventos recentes: ${recentEvents.join(' | ')}`
      : '- Um dia tranquilo explorando a casa.',
    '',
    `Escreva uma página curta do diário (título curto + texto sincero de 2 a 4 frases em português do Brasil).`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await generateDirectWithFallback(ai, prompt, {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
        },
        required: ['title', 'content'],
      },
    });

    const parsed = parseJsonResponse<{ title?: string; content?: string }>(response.text ?? '');
    if (!parsed.title || !parsed.content) {
      return {
        ok: false,
        status: 502,
        error: 'Resposta incompleta ao escrever diário.',
      };
    }

    return {
      ok: true,
      data: {
        title: parsed.title.trim().slice(0, 80),
        content: parsed.content.trim().slice(0, 500),
      },
    };
  } catch (error) {
    return formatClientGeminiError(error);
  }
}

export async function chatWithPet(payload: {
  message: string;
  petName: string;
  mood: string;
  affinity: number;
  hunger: number;
  energy: number;
  health: number;
  isGrumpy: boolean;
  weather?: WeatherType;
  longTermMemory: string;
  recentArtTitles: string[];
  recentDiscoveryTitles: string[];
  lastArtwork: string;
  lastDiscovery: string;
  recentEvents: string[];
  history: ChatMessage[];
}): Promise<
  GeminiApiResult<{
    reply?: string;
    affinityDelta?: number;
    traitKey?: TraitKey;
    traitDelta?: number;
  }>
> {
  const ai = getGeminiClient();
  if (!ai) {
    const noKeyErr = getNoServerFallbackError<{
      reply?: string;
      affinityDelta?: number;
      traitKey?: TraitKey;
      traitDelta?: number;
    }>();
    if (noKeyErr) return noKeyErr;
    return safeFetchJson('/api/pet/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const userMessage = safeStr(payload.message, 400);
  if (!userMessage) {
    return { ok: false, status: 400, error: 'Mensagem vazia.' };
  }

  const petName = safeStr(payload.petName, 32, 'Pipoca');
  const mood = safeStr(payload.mood, 60, 'feliz');
  const affinity = clampNum(payload.affinity, 0, 100, 50);
  const hunger = clampNum(payload.hunger, 0, 100, 75);
  const energy = clampNum(payload.energy, 0, 100, 75);
  const health = clampNum(payload.health, 0, 100, 85);
  const grumpyActive = Boolean(payload.isGrumpy) || affinity < 40;
  const weatherLabel = ALLOWED_WEATHER_LABELS[payload.weather ?? 'sunny'] ?? 'ensolarado';
  const longTermMemory = safeStr(payload.longTermMemory, 400);
  const recentArtTitles = safeStrArray(payload.recentArtTitles, 5, 80);
  const recentDiscoveryTitles = safeStrArray(payload.recentDiscoveryTitles, 5, 80);
  const lastArtwork = safeStr(payload.lastArtwork, 140);
  const lastDiscovery = safeStr(payload.lastDiscovery, 160);
  const recentEvents = safeStrArray(payload.recentEvents, 4, 100);

  const historyItems = Array.isArray(payload.history)
    ? payload.history
        .slice(-6)
        .map((m) => {
          const sender = m.sender === 'user' ? 'Humano' : petName;
          const text = safeStr(m.text, 220);
          return text ? `${sender}: ${text}` : null;
        })
        .filter((line): line is string => Boolean(line))
    : [];

  const systemPrompt = [
    `Você é ${petName}, um virtual pet com memória e personalidade própria.`,
    `Responda em português do Brasil em no máximo 2 ou 3 frases curtas e naturais (como uma conversa real).`,
    grumpyActive
      ? `EMBURRADO (Afinidade < 40 ou chateado): responda de forma seca, fria e bem curta (1 frase seca, sem emojis fofos).`
      : '',
    `Status: Fome ${hunger}% | Energia ${energy}% | Saúde ${health}% | Humor: ${mood} | Afinidade ${affinity}/100 | Clima lá fora: ${weatherLabel}`,
    longTermMemory ? `Memória de longo prazo: ${longTermMemory}` : '',
    recentArtTitles.length > 0 ? `Artes criadas: ${recentArtTitles.join('; ')}` : '',
    recentDiscoveryTitles.length > 0
      ? `Descobertas recentes: ${recentDiscoveryTitles.join('; ')}`
      : '',
    lastArtwork ? `Última arte: ${lastArtwork}` : '',
    lastDiscovery ? `Última descoberta: ${lastDiscovery}` : '',
    recentEvents.length > 0 ? `Memórias recentes: ${recentEvents.join(' | ')}` : '',
    `Retorne JSON: reply, affinityDelta (-5 a 5), traitKey (curioso/nerd/filosofo/artistico/carinhoso/trabalhador/preguicoso) e traitDelta (0 a 3).`,
  ]
    .filter(Boolean)
    .join('\n');

  const conversationContext = [
    historyItems.length > 0 ? `Últimas mensagens:\n${historyItems.join('\n')}` : '',
    `Humano: ${userMessage}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await generateDirectWithFallback(ai, conversationContext, {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 220,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          affinityDelta: { type: Type.INTEGER },
          traitKey: { type: Type.STRING },
          traitDelta: { type: Type.INTEGER },
        },
        required: ['reply', 'affinityDelta', 'traitKey', 'traitDelta'],
      },
    });

    const parsed = parseJsonResponse<{
      reply?: string;
      affinityDelta?: number;
      traitKey?: string;
      traitDelta?: number;
    }>(response.text ?? '');

    if (!parsed.reply) {
      return { ok: false, status: 502, error: 'Resposta vazia no chat do pet.' };
    }

    const traitKey: TraitKey = VALID_TRAITS.includes(parsed.traitKey as TraitKey)
      ? (parsed.traitKey as TraitKey)
      : 'carinhoso';

    return {
      ok: true,
      data: {
        reply: parsed.reply.trim().slice(0, 420),
        affinityDelta: clampNum(parsed.affinityDelta, -5, 5, 1),
        traitKey,
        traitDelta: clampNum(parsed.traitDelta, 0, 3, 1),
      },
    };
  } catch (error) {
    return formatClientGeminiError(error);
  }
}

export async function summarizePetMemory(payload: {
  petName: string;
  currentMemory: string;
  recentMessages: ChatMessage[];
  recentEvents: string[];
}): Promise<GeminiApiResult<{ longTermMemory?: string }>> {
  const ai = getGeminiClient();
  if (!ai) {
    const noKeyErr = getNoServerFallbackError<{ longTermMemory?: string }>();
    if (noKeyErr) return noKeyErr;
    return safeFetchJson('/api/pet/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const petName = safeStr(payload.petName, 32, 'Pipoca');
  const currentMemory = safeStr(payload.currentMemory, 400);
  const recentEvents = safeStrArray(payload.recentEvents, 6, 110);
  const recentMessages = Array.isArray(payload.recentMessages)
    ? payload.recentMessages
        .slice(-8)
        .map((m) => {
          const sender = m.sender === 'user' ? 'Humano' : petName;
          const text = safeStr(m.text, 220);
          return text ? `${sender}: ${text}` : null;
        })
        .filter((line): line is string => Boolean(line))
    : [];

  if (!currentMemory && recentMessages.length === 0 && recentEvents.length === 0) {
    return { ok: true, data: { longTermMemory: '' } };
  }

  const prompt = [
    `Atualize o resumo de memória de longo prazo do virtual pet ${petName} com o humano.`,
    currentMemory ? `Memória anterior: ${currentMemory}` : 'Memória anterior: (vazia)',
    recentMessages.length > 0 ? `Conversa recente:\n${recentMessages.join('\n')}` : '',
    recentEvents.length > 0 ? `Eventos recentes: ${recentEvents.join(' | ')}` : '',
    '',
    `Preserve fatos marcantes da relação (promessas, brigas, flagras no diário/PC, apelidos, gostos e preferências do jogador) em um único texto denso e curto em português do Brasil com NO MÁXIMO 380 caracteres.`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await generateDirectWithFallback(ai, prompt, {
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 180,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          longTermMemory: { type: Type.STRING },
        },
        required: ['longTermMemory'],
      },
    });

    const parsed = parseJsonResponse<{ longTermMemory?: string }>(response.text ?? '');
    return {
      ok: true,
      data: {
        longTermMemory: safeStr(parsed.longTermMemory, 400, currentMemory),
      },
    };
  } catch (error) {
    return formatClientGeminiError(error);
  }
}
