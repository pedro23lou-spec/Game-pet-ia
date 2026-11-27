import type {
  ChatMessage,
  PetAppearance,
  PetTraits,
  TimeOfDay,
  TraitKey,
  WeatherType,
} from '../types/game';

export const USER_GEMINI_API_KEY_STORAGE = 'user_gemini_api_key';

const GEMINI_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash-lite',
  'gemini-3.8-flash',
] as const;

const PER_MODEL_TIMEOUT_MS = 4000;

function getGeminiModelEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export type GeminiApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; code?: string };

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

export function hasConfiguredApiKey(): boolean {
  return hasLocalUserApiKey();
}

function getMissingKeyResult<T>(): GeminiApiResult<T> {
  return {
    ok: false,
    status: 401,
    code: 'NO_API_KEY',
    error: 'Conecte sua chave gratuita do Google AI Studio para usar este recurso.',
  };
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
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonSlice =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  return JSON.parse(jsonSlice) as T;
}

interface GeminiRestPart {
  text?: string;
  thought?: boolean;
}

interface GeminiRestResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiRestPart[];
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function extractFinalResponseText(data: GeminiRestResponse | null | undefined): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => !p.thought && typeof p.text === 'string' && p.text.length > 0)
    .map((p) => p.text as string)
    .join('')
    .trim();
}

/**
 * Direct browser-to-Google REST API call via native `fetch` (zero SDK / zero proxy).
 */
export async function callGeminiDirect(
  prompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  }
): Promise<GeminiApiResult<string>> {
  const apiKey = getStoredUserApiKey();
  if (!apiKey) {
    return getMissingKeyResult();
  }

  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.8,
    maxOutputTokens: options?.maxOutputTokens ?? 250,
  };
  if (options?.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  });

  let lastFailure: GeminiApiResult<string> = {
    ok: false,
    status: 503,
    error: 'Todos os modelos Gemini falharam ou estão temporariamente indisponíveis.',
  };

  for (const model of GEMINI_FALLBACK_MODELS) {
    const url = `${getGeminiModelEndpoint(model)}?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errJson: GeminiRestResponse | null = null;
        try {
          errJson = (await response.json()) as GeminiRestResponse;
        } catch {
          errJson = null;
        }

        const message =
          errJson?.error?.message?.trim() || `Erro HTTP ${response.status} na API Gemini.`;
        const upperMsg = message.toUpperCase();

        if (
          response.status === 401 ||
          response.status === 403 ||
          upperMsg.includes('API_KEY_INVALID') ||
          upperMsg.includes('API KEY NOT VALID') ||
          upperMsg.includes('PERMISSION_DENIED')
        ) {
          return {
            ok: false,
            status: response.status,
            code: 'INVALID_API_KEY',
            error: message,
          };
        }

        const isQuota =
          response.status === 429 ||
          upperMsg.includes('RESOURCE_EXHAUSTED') ||
          upperMsg.includes('QUOTA');

        lastFailure = isQuota
          ? {
              ok: false,
              status: 429,
              code: 'QUOTA_EXCEEDED',
              error:
                'Seu pet precisou fazer uma pausa para descansar a mente. Tente novamente em alguns minutinhos!',
            }
          : response.status === 503
            ? {
                ok: false,
                status: 503,
                error: 'Seu pet se distraiu agora e não respondeu. Tente de novo em instantes!',
              }
            : {
                ok: false,
                status: response.status,
                error: message,
              };

        if (response.status === 503 || response.status === 429 || response.status === 404) {
          continue;
        }

        return lastFailure;
      }

      const data = (await response.json()) as GeminiRestResponse;
      const text = extractFinalResponseText(data);
      if (!text) {
        lastFailure = {
          ok: false,
          status: 502,
          error: 'Seu pet ficou pensativo e não concluiu a resposta. Tente novamente!',
        };
        continue;
      }

      return { ok: true, data: text };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastFailure = {
          ok: false,
          status: 504,
          error: 'Seu pet se distraiu por um momento. Tente enviar novamente!',
        };
        continue;
      }

      const fallbackMsg =
        err instanceof Error && err.message
          ? `Falha de rede ao chamar a API Gemini: ${err.message}`
          : 'Falha de conexão ao chamar a API Gemini.';
      lastFailure = {
        ok: false,
        status: 502,
        error: fallbackMsg,
      };
      continue;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return lastFailure;
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
    `Retorne APENAS um JSON válido (sem markdown e sem texto fora do JSON) com estas chaves exatas:`,
    `{`,
    `  "primaryColor": "#RRGGBB (cor principal do corpo)",`,
    `  "secondaryColor": "#RRGGBB (cor de detalhes/orelhas/barriga)",`,
    `  "accentColor": "#RRGGBB (cor de acessório/bochechas)",`,
    `  "bodyShape": "round" | "chubby" | "tall" | "boxy",`,
    `  "earStyle": "cat" | "floppy" | "antenna" | "horns" | "none",`,
    `  "eyeStyle": "round" | "sleepy" | "sparkle" | "visor",`,
    `  "accessory": "none" | "scarf" | "bow" | "crown" | "glasses" | "bolt",`,
    `  "tagline": "frase curta de apresentação em primeira pessoa (pt-BR)",`,
    `  "traits": { "curioso": 5..45, "nerd": 5..45, "filosofo": 5..45, "artistico": 5..45, "carinhoso": 5..45, "trabalhador": 5..45, "preguicoso": 5..45 }`,
    `}`,
  ].join('\n');

  const res = await callGeminiDirect(prompt, {
    temperature: 0.8,
    maxOutputTokens: 500,
    responseMimeType: 'application/json',
  });
  if (!res.ok) return res;

  try {
    const parsed = parseJsonResponse<Record<string, unknown>>(res.data);
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
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'O modelo retornou um JSON inválido ao criar o visual do pet.',
    };
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
    `- Use de 8 a 14 formas geométricas simples e bem compostas (<rect>, <circle>, <ellipse>, <polygon>, <polyline>, <path>, <line>) com um fundo colorido cobrindo todo o quadro 200x200.`,
    `- NÃO use <script>, <image>, <foreignObject> ou links externos.`,
    `- Retorne APENAS um JSON válido com as chaves "title", "explanation" e "svg" (em português do Brasil natural e em primeira pessoa).`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callGeminiDirect(prompt, {
    temperature: 0.8,
    maxOutputTokens: 500,
    responseMimeType: 'application/json',
  });
  if (!res.ok) return res;

  try {
    const parsed = parseJsonResponse<{
      title?: string;
      explanation?: string;
      svg?: string;
    }>(res.data);

    if (!parsed.title || !parsed.explanation || !parsed.svg) {
      return {
        ok: false,
        status: 502,
        error: 'Formato incompleto retornado pelo modelo Gemini ao pintar.',
      };
    }

    const cleanSvg = sanitizeSvgMarkup(parsed.svg);
    return {
      ok: true,
      data: {
        title: parsed.title.trim().slice(0, 120),
        explanation: parsed.explanation.trim().slice(0, 800),
        svg: cleanSvg,
      },
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error:
        err instanceof Error ? err.message : 'Erro ao interpretar a pintura SVG retornada.',
    };
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
    `Retorne APENAS um JSON válido com as chaves: "topic" (string), "learned" (string), "traitKey" ("curioso"|"nerd"|"filosofo"|"artistico"|"carinhoso") e "traitDelta" (inteiro 2..5).`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callGeminiDirect(prompt, {
    temperature: 0.8,
    maxOutputTokens: 500,
    responseMimeType: 'application/json',
  });
  if (!res.ok) return res;

  try {
    const parsed = parseJsonResponse<{
      topic?: string;
      learned?: string;
      traitKey?: string;
      traitDelta?: number;
    }>(res.data);

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
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'Formato JSON inválido ao gerar descoberta.',
    };
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
    `Retorne APENAS um JSON válido com as chaves "title" (título curto) e "content" (texto sincero de 2 a 4 frases em português do Brasil).`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callGeminiDirect(prompt, {
    temperature: 0.8,
    maxOutputTokens: 500,
    responseMimeType: 'application/json',
  });
  if (!res.ok) return res;

  try {
    const parsed = parseJsonResponse<{ title?: string; content?: string }>(res.data);
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
        title: parsed.title.trim().slice(0, 120),
        content: parsed.content.trim().slice(0, 1200),
      },
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'Formato JSON inválido ao escrever diário.',
    };
  }
}

function stripTrailingMetaTag(raw: string): {
  visibleText: string;
  affinityDelta?: number;
  traitKey?: TraitKey;
  traitDelta?: number;
} {
  const fullMatch = raw.match(/\[\[\s*(-?\d+)\s*\|\s*([^\s|\]]+)\s*\|\s*(\d+)\s*\]\]/i);
  const visibleText = raw.replace(/\[\[.*?\]\]/gs, '').replace(/\s+\n/g, '\n').trim();

  if (fullMatch) {
    const normalizedTrait = fullMatch[2]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') as TraitKey;
    return {
      visibleText,
      affinityDelta: clampNum(Number(fullMatch[1]), -5, 5, 1),
      traitKey: VALID_TRAITS.includes(normalizedTrait) ? normalizedTrait : 'carinhoso',
      traitDelta: clampNum(Number(fullMatch[3]), 0, 3, 1),
    };
  }

  return { visibleText };
}

function isApologyMessage(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\b(desculp\w*|perdo\w*|perdao|foi mal|sinto muito|lamento|arrepend\w*|me perdoa)\b/.test(
    normalized
  );
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
  recentEvents: string[];
  history: ChatMessage[];
}): Promise<
  GeminiApiResult<{
    reply: string;
    affinityDelta: number;
    traitKey: TraitKey;
    traitDelta: number;
  }>
> {
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
  const apologyDetected = isApologyMessage(userMessage);
  const weatherLabel = ALLOWED_WEATHER_LABELS[payload.weather ?? 'sunny'] ?? 'ensolarado';
  const longTermMemory = safeStr(payload.longTermMemory, 400);
  const recentArtTitles = safeStrArray(payload.recentArtTitles, 5, 80);
  const recentDiscoveryTitles = safeStrArray(payload.recentDiscoveryTitles, 5, 80);
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

  const prompt = [
    `Você é ${petName}, um virtual pet com memória e personalidade própria.`,
    `Responda diretamente ao humano em português do Brasil em texto natural (NO MÁXIMO 2 ou 3 frases curtas, sem JSON e sem aspas em volta).`,
    grumpyActive
      ? apologyDetected
        ? `EMBURRADO (Afinidade < 40), mas o humano pediu desculpas: você ainda pode responder meio emburrado no início, porém reconheça o pedido de desculpas e comece a ceder um pouco.`
        : `EMBURRADO (Afinidade < 40 ou chateado): responda de forma seca, fria e bem curta (1 frase seca, sem emojis fofos).`
      : '',
    `Status: Fome ${hunger}% | Energia ${energy}% | Saúde ${health}% | Humor: ${mood} | Afinidade ${affinity}/100 | Clima lá fora: ${weatherLabel}`,
    longTermMemory ? `Memória de longo prazo: ${longTermMemory}` : '',
    recentArtTitles.length > 0 ? `Artes criadas: ${recentArtTitles.join('; ')}` : '',
    recentDiscoveryTitles.length > 0
      ? `Descobertas recentes: ${recentDiscoveryTitles.join('; ')}`
      : '',
    recentEvents.length > 0 ? `Memórias recentes: ${recentEvents.join(' | ')}` : '',
    historyItems.length > 0 ? `Últimas mensagens:\n${historyItems.join('\n')}` : '',
    `Humano: ${userMessage}`,
    `Ao final da última linha, adicione apenas a tag discreta [[affinityDelta|traitKey|traitDelta]] com affinityDelta de -5 a 5, traitKey em (curioso, nerd, filosofo, artistico, carinhoso, trabalhador, preguicoso) e traitDelta de 0 a 3.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const res = await callGeminiDirect(prompt, {
    temperature: 0.8,
    maxOutputTokens: 250,
  });
  if (!res.ok) return res;

  const parsed = stripTrailingMetaTag(res.data);
  const reply = parsed.visibleText.replace(/\[\[.*?\]\]/gs, '').trim().slice(0, 600);
  if (!reply) {
    return { ok: false, status: 502, error: 'Resposta vazia no chat do pet.' };
  }

  const baseDelta = parsed.affinityDelta ?? 2;
  const finalAffinityDelta = apologyDetected ? Math.max(3, baseDelta) : Math.max(2, baseDelta);

  return {
    ok: true,
    data: {
      reply,
      affinityDelta: finalAffinityDelta,
      traitKey: parsed.traitKey ?? 'carinhoso',
      traitDelta: parsed.traitDelta ?? 1,
    },
  };
}

export async function summarizePetMemory(payload: {
  petName: string;
  currentMemory: string;
  recentMessages: ChatMessage[];
  recentEvents: string[];
}): Promise<GeminiApiResult<{ longTermMemory?: string }>> {
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
    `Retorne APENAS um JSON válido com a chave "longTermMemory".`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callGeminiDirect(prompt, {
    maxOutputTokens: 500,
    responseMimeType: 'application/json',
  });
  if (!res.ok) return res;

  try {
    const parsed = parseJsonResponse<{ longTermMemory?: string }>(res.data);
    return {
      ok: true,
      data: {
        longTermMemory: safeStr(parsed.longTermMemory, 400, currentMemory),
      },
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'Erro ao resumir memória de longo prazo.',
    };
  }
}
