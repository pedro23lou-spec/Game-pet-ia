import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_INTERACTIVE_MODEL = "gemini-4-hydrogen";
const AUTONOMOUS_LITE_MODEL = "gemini-3.1-flash-lite";

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errObj = error as { status?: unknown; message?: unknown };
  if (errObj.status === 429) return true;
  const msg = typeof errObj.message === "string" ? errObj.message : String(error);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("rate-limit")
  );
}

async function generateWithModelFallback(
  ai: GoogleGenAI,
  models: readonly string[],
  request: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">
) {
  let lastError: unknown;
  for (const model of models) {
    try {
      return await ai.models.generateContent({
        model,
        ...request,
      });
    } catch (err) {
      lastError = err;
      if (isQuotaError(err)) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errObj = error as { status?: unknown; message?: unknown };
  if (errObj.status === 400 || errObj.status === 401 || errObj.status === 403) return true;
  const msg = typeof errObj.message === "string" ? errObj.message : String(error);
  return msg.includes("API_KEY_INVALID") || msg.includes("PERMISSION_DENIED");
}

function sendGeminiError(res: Response, endpoint: string, error: unknown): void {
  if (isQuotaError(error)) {
    console.warn(`Cota atingida em ${endpoint} (429 RESOURCE_EXHAUSTED).`);
    res.status(429).json({
      code: "QUOTA_EXCEEDED",
      error:
        "Limite gratuito da API Gemini atingido no momento. Aguarde alguns instantes ou configure uma chave com faturamento em Settings > Secrets.",
    });
    return;
  }
  if (isAuthError(error)) {
    res.status(401).json({
      code: "INVALID_API_KEY",
      error:
        "A chave da API Gemini parece inválida. Confira em Settings > Secrets ou na engrenagem (⚙️).",
    });
    return;
  }
  const message =
    error instanceof Error ? error.message : "Erro ao comunicar com a API Gemini.";
  console.error(`Erro em ${endpoint}:`, error);
  res.status(502).json({ error: message });
}

const ALLOWED_TIME_LABELS: Record<string, string> = {
  day: "dia ensolarado",
  dusk: "entardecer dourado",
  night: "noite aconchegante",
};

const ALLOWED_WEATHER_LABELS: Record<string, string> = {
  sunny: "ensolarado e agradável",
  cloudy: "nublado com nuvens passando",
  rainy: "chuvoso lá fora no quintal",
};

const VALID_TRAITS = [
  "curioso",
  "nerd",
  "filosofo",
  "artistico",
  "carinhoso",
  "trabalhador",
  "preguicoso",
] as const;
type ValidTrait = (typeof VALID_TRAITS)[number];

const BODY_SHAPES = ["round", "chubby", "tall", "boxy"] as const;
const EAR_STYLES = ["cat", "floppy", "antenna", "horns", "none"] as const;
const EYE_STYLES = ["round", "sleepy", "sparkle", "visor"] as const;
const ACCESSORY_STYLES = ["none", "scarf", "bow", "crown", "glasses", "bolt"] as const;

function resolveServerGeminiKey(): string {
  const candidates = [process.env.GEMINI_API_KEY, process.env.API_KEY];
  for (const raw of candidates) {
    if (typeof raw === "string") {
      const cleaned = raw.trim();
      if (cleaned && cleaned !== "MY_GEMINI_API_KEY") {
        return cleaned;
      }
    }
  }
  return "";
}

function getGeminiClient(userKeyOverride?: string): GoogleGenAI {
  const cleanedOverride = typeof userKeyOverride === "string" ? userKeyOverride.trim() : "";
  const apiKey = cleanedOverride || resolveServerGeminiKey();
  if (!apiKey) {
    throw new Error(
      "NO_API_KEY: Chave de API do Gemini não configurada. Adicione GEMINI_API_KEY nas configurações de Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getClientOrSend401(req: Request, res: Response): GoogleGenAI | null {
  try {
    return getGeminiClient(req.header("x-user-gemini-key"));
  } catch (e) {
    res.status(401).json({
      code: "NO_API_KEY",
      error:
        e instanceof Error
          ? e.message.replace(/^NO_API_KEY:\s*/, "")
          : "Chave de API do Gemini não configurada.",
    });
    return null;
  }
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || Number.isNaN(val)) return fallback;
  return Math.round(Math.max(min, Math.min(max, val)));
}

function safeStr(val: unknown, maxLen: number, fallback = ""): string {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : fallback;
}

function safeHexColor(val: unknown, fallback: string): string {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function safeStrArray(val: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxItemLen))
    .slice(0, maxItems);
}

function sanitizeTraits(raw: unknown): Record<ValidTrait, number> {
  const base: Record<ValidTrait, number> = {
    curioso: 20,
    nerd: 15,
    filosofo: 15,
    artistico: 20,
    carinhoso: 25,
    trabalhador: 15,
    preguicoso: 15,
  };
  if (raw && typeof raw === "object") {
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
    throw new Error("O modelo não retornou um código SVG válido.");
  }

  let svg = svgMatch[0];
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  if (!/viewBox\s*=/i.test(svg.slice(0, svg.indexOf(">") + 1))) {
    svg = svg.replace(/<svg/i, '<svg viewBox="0 0 200 200"');
  }

  return svg;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "320kb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    const hasServerKey = Boolean(resolveServerGeminiKey());
    res.json({ ok: true, hasServerKey });
  });

  // 0. Create Companion Appearance from Prompt
  app.post("/api/pet/create-appearance", async (req: Request, res: Response) => {
    const ai = getClientOrSend401(req, res);
    if (!ai) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const petName = safeStr(body.petName, 24, "Pipoca");
    const description = safeStr(
      body.description,
      240,
      "um bichinho fofo e curioso cor de caramelo"
    );

    const prompt = [
      `Você está criando a aparência 2D e personalidade inicial de um virtual pet chamado "${petName}".`,
      `Descrição desejada pelo jogador: "${description}"`,
      "",
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
    ].join("\n");

    try {
      const response = await generateWithModelFallback(
        ai,
        [PRIMARY_INTERACTIVE_MODEL, AUTONOMOUS_LITE_MODEL],
        {
          contents: prompt,
          config: {
            responseMimeType: "application/json",
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
                    "curioso",
                    "nerd",
                    "filosofo",
                    "artistico",
                    "carinhoso",
                    "trabalhador",
                    "preguicoso",
                  ],
                },
              },
              required: [
                "primaryColor",
                "secondaryColor",
                "accentColor",
                "bodyShape",
                "earStyle",
                "eyeStyle",
                "accessory",
                "tagline",
                "traits",
              ],
            },
          },
        }
      );

      const rawText = (response.text ?? "").trim();
      const parsed = JSON.parse(rawText) as Record<string, unknown>;

      const bodyShape = BODY_SHAPES.includes(parsed.bodyShape as (typeof BODY_SHAPES)[number])
        ? (parsed.bodyShape as (typeof BODY_SHAPES)[number])
        : "round";
      const earStyle = EAR_STYLES.includes(parsed.earStyle as (typeof EAR_STYLES)[number])
        ? (parsed.earStyle as (typeof EAR_STYLES)[number])
        : "cat";
      const eyeStyle = EYE_STYLES.includes(parsed.eyeStyle as (typeof EYE_STYLES)[number])
        ? (parsed.eyeStyle as (typeof EYE_STYLES)[number])
        : "round";
      const accessory = ACCESSORY_STYLES.includes(
        parsed.accessory as (typeof ACCESSORY_STYLES)[number]
      )
        ? (parsed.accessory as (typeof ACCESSORY_STYLES)[number])
        : "none";

      res.json({
        appearance: {
          primaryColor: safeHexColor(parsed.primaryColor, "#FFE3BF"),
          secondaryColor: safeHexColor(parsed.secondaryColor, "#FFF5E6"),
          accentColor: safeHexColor(parsed.accentColor, "#E07A5F"),
          bodyShape,
          earStyle,
          eyeStyle,
          accessory,
          descriptionPrompt: description,
        },
        traits: sanitizeTraits(parsed.traits),
        tagline: safeStr(parsed.tagline, 140, `Oi! Eu sou ${petName}, pronto para explorar!`),
      });
    } catch (error) {
      sendGeminiError(res, "/api/pet/create-appearance", error);
    }
  });

  // 1. Paint Artwork (SVG)
  app.post("/api/pet/paint", async (req: Request, res: Response) => {
    const ai = getClientOrSend401(req, res);
    if (!ai) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const petName = safeStr(body.petName, 32, "Pipoca");
    const mood = safeStr(body.mood, 60, "curioso e feliz");
    const timeKey = safeStr(body.timeOfDay, 16, "day");
    const timeLabel = ALLOWED_TIME_LABELS[timeKey] ?? "dia ensolarado";
    const hunger = clampNum(body.hunger, 0, 100, 75);
    const energy = clampNum(body.energy, 0, 100, 75);
    const inspiration = clampNum(body.inspiration, 0, 100, 85);
    const nearbyObjects = safeStrArray(body.nearbyObjects, 8, 40);
    const previousTitles = safeStrArray(body.previousTitles, 6, 80);

    const prompt = [
      `Você é ${petName}, um bichinho virtual fofo, expressivo e criativo que acabou de ir até seu cavalete de pintura para criar um quadro.`,
      `Contexto atual do pet:`,
      `- Humor atual: ${mood}`,
      `- Momento do dia lá fora: ${timeLabel}`,
      `- Saciedade (fome): ${hunger}% | Energia: ${energy}% | Inspiração: ${inspiration}%`,
      nearbyObjects.length > 0
        ? `- Objetos na casa que você observa: ${nearbyObjects.join(", ")}`
        : `- A casa está bem minimalista hoje.`,
      previousTitles.length > 0
        ? `- Títulos de quadros que você já pintou antes (crie algo diferente!): ${previousTitles.join("; ")}`
        : "",
      "",
      `Crie uma obra de arte original em SVG colorido e encantador que reflita sua personalidade e humor atual.`,
      `Regras obrigatórias para o SVG:`,
      `- Deve começar com <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"> e terminar com </svg>.`,
      `- Use de 8 a 28 formas geométricas simples e bem compostas (<rect>, <circle>, <ellipse>, <polygon>, <polyline>, <path>, <line>) com um fundo colorido cobrindo todo o quadro 200x200.`,
      `- Escolha uma paleta harmônica e vibrante, com camadas e detalhes bonitos.`,
      `- NÃO use <script>, <image>, <foreignObject> ou links externos.`,
      `- Escreva o título e a frase explicativa em português do Brasil natural, fofo e em primeira pessoa.`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await generateWithModelFallback(
        ai,
        [AUTONOMOUS_LITE_MODEL, PRIMARY_INTERACTIVE_MODEL],
        {
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                explanation: { type: Type.STRING },
                svg: { type: Type.STRING },
              },
              required: ["title", "explanation", "svg"],
            },
          },
        }
      );

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        res.status(502).json({ error: "Resposta vazia recebida do modelo Gemini." });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        explanation?: string;
        svg?: string;
      };

      if (!parsed.title || !parsed.explanation || !parsed.svg) {
        res.status(502).json({ error: "Formato incompleto retornado pelo modelo Gemini." });
        return;
      }

      const cleanSvg = sanitizeSvgMarkup(parsed.svg);
      res.json({
        title: parsed.title.trim().slice(0, 80),
        explanation: parsed.explanation.trim().slice(0, 240),
        svg: cleanSvg,
      });
    } catch (error) {
      sendGeminiError(res, "/api/pet/paint", error);
    }
  });

  // 2. Internet Discovery
  app.post("/api/pet/discover", async (req: Request, res: Response) => {
    const ai = getClientOrSend401(req, res);
    if (!ai) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const petName = safeStr(body.petName, 32, "Pipoca");
    const mood = safeStr(body.mood, 60, "curioso");
    const traits = sanitizeTraits(body.traits);
    const previousTopics = safeStrArray(body.previousTopics, 8, 80);

    const prompt = [
      `Você é ${petName}, um bichinho virtual fofo que acabou de usar o computador da casa para pesquisar na internet sozinho.`,
      `Humor atual: ${mood}`,
      `Traços atuais: curioso=${traits.curioso}, nerd=${traits.nerd}, filosofo=${traits.filosofo}, artistico=${traits.artistico}, carinhoso=${traits.carinhoso}.`,
      previousTopics.length > 0
        ? `Temas já pesquisados antes (escolha algo diferente): ${previousTopics.join("; ")}`
        : "",
      "",
      `Invente uma pesquisa espontânea fascinante e real sobre curiosidades do espaço, animais, ciência, natureza, música, história ou filosofia.`,
      `Conte o que você aprendeu em português do Brasil com a sua voz de pet empolgado (2 a 3 frases curtas).`,
      `Escolha um traço estimulado ("curioso", "nerd", "filosofo", "artistico" ou "carinhoso") e um ganho inteiro entre 2 e 5.`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await generateWithModelFallback(
        ai,
        [AUTONOMOUS_LITE_MODEL, PRIMARY_INTERACTIVE_MODEL],
        {
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                learned: { type: Type.STRING },
                traitKey: { type: Type.STRING },
                traitDelta: { type: Type.INTEGER },
              },
              required: ["topic", "learned", "traitKey", "traitDelta"],
            },
          },
        }
      );

      const rawText = (response.text ?? "").trim();
      const parsed = JSON.parse(rawText) as {
        topic?: string;
        learned?: string;
        traitKey?: string;
        traitDelta?: number;
      };

      if (!parsed.topic || !parsed.learned) {
        res.status(502).json({ error: "Resposta incompleta ao gerar descoberta." });
        return;
      }

      const allowedDiscTraits = ["curioso", "nerd", "filosofo", "artistico", "carinhoso"] as const;
      const traitKey = allowedDiscTraits.includes(parsed.traitKey as (typeof allowedDiscTraits)[number])
        ? (parsed.traitKey as (typeof allowedDiscTraits)[number])
        : "curioso";
      const traitDelta = clampNum(parsed.traitDelta, 1, 6, 3);

      res.json({
        topic: parsed.topic.trim().slice(0, 90),
        learned: parsed.learned.trim().slice(0, 420),
        traitKey,
        traitDelta,
      });
    } catch (error) {
      sendGeminiError(res, "/api/pet/discover", error);
    }
  });

  // 3. Chat with Live Memory (Fast Low-Latency Prompt + Minimal Thinking)
  app.post("/api/pet/chat", async (req: Request, res: Response) => {
    const ai = getClientOrSend401(req, res);
    if (!ai) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const userMessage = safeStr(body.message, 400);
    if (!userMessage) {
      res.status(400).json({ error: "Mensagem vazia." });
      return;
    }

    const petName = safeStr(body.petName, 32, "Pipoca");
    const mood = safeStr(body.mood, 60, "feliz");
    const affinity = clampNum(body.affinity, 0, 100, 50);
    const hunger = clampNum(body.hunger, 0, 100, 75);
    const energy = clampNum(body.energy, 0, 100, 75);
    const health = clampNum(body.health, 0, 100, 85);
    const isGrumpy = Boolean(body.isGrumpy);
    const weatherKey = safeStr(body.weather, 16, "sunny");
    const weatherLabel = ALLOWED_WEATHER_LABELS[weatherKey] ?? "ensolarado";
    const lastArtwork = safeStr(body.lastArtwork, 140);
    const lastDiscovery = safeStr(body.lastDiscovery, 160);
    const longTermMemory = safeStr(body.longTermMemory, 400);
    const recentArtTitles = safeStrArray(body.recentArtTitles, 5, 80);
    const recentDiscoveryTitles = safeStrArray(body.recentDiscoveryTitles, 5, 80);
    const recentEvents = safeStrArray(body.recentEvents, 4, 100);

    const historyItems = Array.isArray(body.history)
      ? body.history
          .slice(-6)
          .map((m) => {
            if (!m || typeof m !== "object") return null;
            const item = m as { sender?: unknown; text?: unknown };
            const sender = item.sender === "user" ? "Humano" : petName;
            const text = safeStr(item.text, 220);
            return text ? `${sender}: ${text}` : null;
          })
          .filter((line): line is string => Boolean(line))
      : [];

    const grumpyActive = isGrumpy || affinity < 40;
    const systemPrompt = [
      `Você é ${petName}, um virtual pet com memória e personalidade própria.`,
      `Responda em português do Brasil em no máximo 2 ou 3 frases curtas e naturais (como uma conversa real).`,
      grumpyActive
        ? `EMBURRADO (Afinidade < 40 ou chateado): responda de forma seca, fria e bem curta (1 frase seca, sem emojis fofos).`
        : "",
      `Status: Fome ${hunger}% | Energia ${energy}% | Saúde ${health}% | Humor: ${mood} | Afinidade ${affinity}/100 | Clima lá fora: ${weatherLabel}`,
      longTermMemory ? `Memória de longo prazo: ${longTermMemory}` : "",
      recentArtTitles.length > 0 ? `Artes criadas: ${recentArtTitles.join("; ")}` : "",
      recentDiscoveryTitles.length > 0
        ? `Descobertas recentes: ${recentDiscoveryTitles.join("; ")}`
        : "",
      lastArtwork ? `Última arte: ${lastArtwork}` : "",
      lastDiscovery ? `Última descoberta: ${lastDiscovery}` : "",
      recentEvents.length > 0 ? `Memórias recentes: ${recentEvents.join(" | ")}` : "",
      `Retorne JSON: reply, affinityDelta (-5 a 5), traitKey (curioso/nerd/filosofo/artistico/carinhoso/trabalhador/preguicoso) e traitDelta (0 a 3).`,
    ]
      .filter(Boolean)
      .join("\n");

    const conversationContext = [
      historyItems.length > 0 ? `Últimas mensagens:\n${historyItems.join("\n")}` : "",
      `Humano: ${userMessage}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const chatSchema = {
      type: Type.OBJECT,
      properties: {
        reply: { type: Type.STRING },
        affinityDelta: { type: Type.INTEGER },
        traitKey: { type: Type.STRING },
        traitDelta: { type: Type.INTEGER },
      },
      required: ["reply", "affinityDelta", "traitKey", "traitDelta"],
    };

    try {
      let response;
      try {
        response = await ai.models.generateContent({
          model: AUTONOMOUS_LITE_MODEL,
          contents: conversationContext,
          config: {
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            maxOutputTokens: 220,
            responseMimeType: "application/json",
            responseSchema: chatSchema,
          },
        });
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        response = await ai.models.generateContent({
          model: PRIMARY_INTERACTIVE_MODEL,
          contents: conversationContext,
          config: {
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            maxOutputTokens: 260,
            responseMimeType: "application/json",
            responseSchema: chatSchema,
          },
        });
      }

      const rawText = (response.text ?? "").trim();
      const parsed = JSON.parse(rawText) as {
        reply?: string;
        affinityDelta?: number;
        traitKey?: string;
        traitDelta?: number;
      };

      if (!parsed.reply) {
        res.status(502).json({ error: "Resposta vazia no chat do pet." });
        return;
      }

      const traitKey: ValidTrait = VALID_TRAITS.includes(parsed.traitKey as ValidTrait)
        ? (parsed.traitKey as ValidTrait)
        : "carinhoso";

      res.json({
        reply: parsed.reply.trim().slice(0, 420),
        affinityDelta: clampNum(parsed.affinityDelta, -5, 5, 1),
        traitKey,
        traitDelta: clampNum(parsed.traitDelta, 0, 3, 1),
      });
    } catch (error) {
      sendGeminiError(res, "/api/pet/chat", error);
    }
  });

  // 3b. Evolving Long-Term Memory Summary (Async background helper, max 400 chars)
  app.post("/api/pet/memory", async (req: Request, res: Response) => {
    const ai = getClientOrSend401(req, res);
    if (!ai) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const petName = safeStr(body.petName, 32, "Pipoca");
    const currentMemory = safeStr(body.currentMemory, 400);
    const recentEvents = safeStrArray(body.recentEvents, 6, 110);

    const recentMessages = Array.isArray(body.recentMessages)
      ? body.recentMessages
          .slice(-8)
          .map((m) => {
            if (!m || typeof m !== "object") return null;
            const item = m as { sender?: unknown; text?: unknown };
            const sender = item.sender === "user" ? "Humano" : petName;
            const text = safeStr(item.text, 220);
            return text ? `${sender}: ${text}` : null;
          })
          .filter((line): line is string => Boolean(line))
      : [];

    if (!currentMemory && recentMessages.length === 0 && recentEvents.length === 0) {
      res.json({ longTermMemory: "" });
      return;
    }

    const prompt = [
      `Atualize o resumo de memória de longo prazo do virtual pet ${petName} com o humano.`,
      currentMemory ? `Memória anterior: ${currentMemory}` : "Memória anterior: (vazia)",
      recentMessages.length > 0 ? `Conversa recente:\n${recentMessages.join("\n")}` : "",
      recentEvents.length > 0 ? `Eventos recentes: ${recentEvents.join(" | ")}` : "",
      "",
      `Preserve fatos marcantes da relação (promessas, brigas, flagras no diário/PC, apelidos, gostos e preferências do jogador) em um único texto denso e curto em português do Brasil com NO MÁXIMO 380 caracteres.`,
    ]
      .filter(Boolean)
      .join("\n");

    const memorySchema = {
      type: Type.OBJECT,
      properties: {
        longTermMemory: { type: Type.STRING },
      },
      required: ["longTermMemory"],
    };

    try {
      let response;
      try {
        response = await ai.models.generateContent({
          model: AUTONOMOUS_LITE_MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            maxOutputTokens: 180,
            responseMimeType: "application/json",
            responseSchema: memorySchema,
          },
        });
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        response = await ai.models.generateContent({
          model: PRIMARY_INTERACTIVE_MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            maxOutputTokens: 200,
            responseMimeType: "application/json",
            responseSchema: memorySchema,
          },
        });
      }

      const parsed = JSON.parse((response.text ?? "").trim()) as {
        longTermMemory?: string;
      };
      const updated = safeStr(parsed.longTermMemory, 400, currentMemory);
      res.json({ longTermMemory: updated });
    } catch (error) {
      sendGeminiError(res, "/api/pet/memory", error);
    }
  });

  // 4. Secret Diary Entry Generation
  app.post("/api/pet/diary", async (req: Request, res: Response) => {
    const ai = getClientOrSend401(req, res);
    if (!ai) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const petName = safeStr(body.petName, 32, "Pipoca");
    const mood = safeStr(body.mood, 60, "reflexivo");
    const affinity = clampNum(body.affinity, 0, 100, 50);
    const hunger = clampNum(body.hunger, 0, 100, 75);
    const energy = clampNum(body.energy, 0, 100, 75);
    const health = clampNum(body.health, 0, 100, 85);
    const traits = sanitizeTraits(body.traits);
    const timeKey = safeStr(body.timeOfDay, 16, "day");
    const timeLabel = ALLOWED_TIME_LABELS[timeKey] ?? "dia";
    const weatherKey = safeStr(body.weather, 16, "sunny");
    const weatherLabel = ALLOWED_WEATHER_LABELS[weatherKey] ?? "ensolarado";
    const recentEvents = safeStrArray(body.recentEvents, 6, 120);
    const lastArtwork = safeStr(body.lastArtwork, 120);
    const lastDiscovery = safeStr(body.lastDiscovery, 120);

    const prompt = [
      `Você é ${petName}, escrevendo escondido no seu Diário Secreto pessoal.`,
      `Seja sincero, emotivo, engraçado ou desconfiado de acordo com o que aconteceu:`,
      `- Afinidade com o humano: ${affinity}/100 | Humor: ${mood}`,
      `- Fome: ${hunger}% | Energia: ${energy}% | Saúde: ${health}% | Momento: ${timeLabel} | Clima: ${weatherLabel}`,
      `- Traços: trabalhador=${traits.trabalhador}, preguicoso=${traits.preguicoso}, curioso=${traits.curioso}, carinhoso=${traits.carinhoso}`,
      lastArtwork ? `- Pintou recentemente: ${lastArtwork}` : "",
      lastDiscovery ? `- Descobriu na internet: ${lastDiscovery}` : "",
      recentEvents.length > 0
        ? `- Eventos recentes: ${recentEvents.join(" | ")}`
        : "- Um dia tranquilo explorando a casa.",
      "",
      `Escreva uma página curta do diário (título curto + texto sincero de 2 a 4 frases em português do Brasil).`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await generateWithModelFallback(
        ai,
        [AUTONOMOUS_LITE_MODEL, PRIMARY_INTERACTIVE_MODEL],
        {
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ["title", "content"],
            },
          },
        }
      );

      const rawText = (response.text ?? "").trim();
      const parsed = JSON.parse(rawText) as { title?: string; content?: string };
      if (!parsed.title || !parsed.content) {
        res.status(502).json({ error: "Resposta incompleta ao escrever diário." });
        return;
      }

      res.json({
        title: parsed.title.trim().slice(0, 80),
        content: parsed.content.trim().slice(0, 500),
      });
    } catch (error) {
      sendGeminiError(res, "/api/pet/diary", error);
    }
  });

  // Always return JSON for unknown /api routes (prevents HTML <!doctype fallback!)
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Endpoint da API não encontrado." });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      const message = err instanceof Error ? err.message : "Erro interno no servidor.";
      res.status(500).json({ error: message });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build não encontrado. Execute npm run build.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cantinho do Pet servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
