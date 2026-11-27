import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import type { PetAppearance, PetTraits } from '../types/game';
import { createPetAppearance, isProxyDisabledError } from '../services/geminiService';
import { drawPetCharacter } from '../world/canvasRenderer';
import { DEFAULT_APPEARANCE } from '../world/mapData';

interface CompanionCreatorModalProps {
  isOpen: boolean;
  canCancel: boolean;
  onCancel: () => void;
  onConfirmCompanion: (payload: {
    name: string;
    appearance: PetAppearance;
    traits: PetTraits;
    tagline: string;
  }) => void;
}

const DEFAULT_TRAITS: PetTraits = {
  curioso: 22,
  nerd: 14,
  filosofo: 16,
  artistico: 24,
  carinhoso: 28,
  trabalhador: 15,
  preguicoso: 15,
};

const QUICK_IDEAS = [
  'um gato preto rabugento com cachecol vermelho',
  'um alienígena roxo curioso com antenas',
  'um mini robô enferrujado simpático',
  'um ursinho dourado artista com coroa',
];

export const CompanionCreatorModal: React.FC<CompanionCreatorModalProps> = ({
  isOpen,
  canCancel,
  onCancel,
  onConfirmCompanion,
}) => {
  const [name, setName] = useState('Pipoca');
  const [description, setDescription] = useState('um gato preto rabugento com cachecol vermelho');
  const [appearance, setAppearance] = useState<PetAppearance>(DEFAULT_APPEARANCE);
  const [traits, setTraits] = useState<PetTraits>(DEFAULT_TRAITS);
  const [tagline, setTagline] = useState('Oi! Estou pronto para explorar nossa casa!');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let animId = 0;
    const renderLoop = (now: number) => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const size = 180;
          if (canvas.width !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
          }
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, size, size);

          // Cozy grass circle backdrop
          ctx.fillStyle = '#EBF3E4';
          ctx.beginPath();
          ctx.arc(size / 2, size / 2 + 8, 72, 0, Math.PI * 2);
          ctx.fill();

          const t = now / 1000;
          const blink = t % 3.6 > 3.45;
          drawPetCharacter({
            ctx,
            x: size / 2,
            y: size / 2 + 4,
            appearance,
            timeSec: t,
            scale: 2.15,
            isBlinking: blink,
            isLookingAtScreen: true,
          });
          ctx.restore();
        }
      }
      animId = window.requestAnimationFrame(renderLoop);
    };
    animId = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(animId);
  }, [isOpen, appearance]);

  if (!isOpen) return null;

  const handleGenerate = async (overrideDesc?: string) => {
    const desc = (overrideDesc ?? description).trim();
    if (!desc || isGenerating) return;
    setIsGenerating(true);
    setErrorMsg(null);

    const res = await createPetAppearance({
      petName: name.trim() || 'Pipoca',
      description: desc,
    });

    if (res.ok) {
      setAppearance(res.data.appearance);
      setTraits(res.data.traits);
      setTagline(res.data.tagline);
      setHasGeneratedOnce(true);
    } else if (!isProxyDisabledError(res)) {
      setErrorMsg(res.error);
    }
    setIsGenerating(false);
  };

  const handleConfirm = () => {
    onConfirmCompanion({
      name: name.trim().slice(0, 24) || 'Pipoca',
      appearance,
      traits,
      tagline,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1B1612]/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Criador de Companheiro"
    >
      <div className="w-full max-w-2xl max-h-[92vh] bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5DDD0] flex items-center justify-between gap-3 bg-[#F5EFE6]">
          <div>
            <h2 className="font-display font-bold text-lg sm:text-xl text-[#2B2520]">
              Criar Novo Companheiro
            </h2>
            <p className="text-xs text-[#6C6054]">
              Descreva o pet dos seus sonhos e veja ele ganhar vida na casa!
            </p>
          </div>
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Fechar criador"
              className="p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#E5DDD0]/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Live Animated Canvas Preview */}
          <div className="md:col-span-5 flex flex-col items-center text-center bg-[#F3ECE1]/70 border border-[#E5DDD0] rounded-2xl p-4">
            <canvas
              ref={previewCanvasRef}
              className="w-[180px] h-[180px] block"
              aria-label="Preview animado do pet"
            />
            <p className="mt-2 font-display font-bold text-base text-[#2B2520]">
              {name.trim() || 'Pipoca'}
            </p>
            <p className="mt-1 text-xs text-[#5C5044] italic leading-relaxed">
              “{tagline}”
            </p>
            <div className="mt-3 pt-3 border-t border-[#E5DDD0] w-full text-[11px] text-[#6C6054] flex flex-wrap justify-center gap-x-2 gap-y-1">
              <span>Curioso {traits.curioso}</span>
              <span>·</span>
              <span>Artístico {traits.artistico}</span>
              <span>·</span>
              <span>Nerd {traits.nerd}</span>
            </div>
          </div>

          {/* Prompt Controls */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <label
                htmlFor="creator-pet-name"
                className="block text-xs font-semibold text-[#2B2520] mb-1.5"
              >
                Nome do Companheiro
              </label>
              <input
                id="creator-pet-name"
                type="text"
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pipoca, Salem, Zorp..."
                className="w-full bg-white border border-[#DFD5C5] rounded-xl px-3.5 py-2 text-sm text-[#2B2520] focus:outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label
                htmlFor="creator-pet-desc"
                className="block text-xs font-semibold text-[#2B2520] mb-1.5"
              >
                Descreva a aparência e personalidade
              </label>
              <textarea
                id="creator-pet-desc"
                rows={3}
                value={description}
                maxLength={220}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: um gato preto rabugento com cachecol..."
                className="w-full bg-white border border-[#DFD5C5] rounded-xl px-3.5 py-2 text-sm text-[#2B2520] focus:outline-none focus:border-amber-600 resize-none"
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => {
                      setDescription(idea);
                      void handleGenerate(idea);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#EFE8DC] hover:bg-[#E5DDD0] text-[#4A4036] transition-colors cursor-pointer text-left"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || !description.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gerando visual...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{hasGeneratedOnce ? 'Gerar outro visual' : 'Gerar Visual'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2B2520] text-[#FAF7F2] text-xs font-semibold hover:bg-[#3E352D] transition-colors cursor-pointer"
              >
                Começar Aventura
              </button>
            </div>

            <p className="text-[11px] text-[#7A6E61] leading-relaxed">
              Você começa em uma casa humilde com <strong>100 Moedas</strong>, uma Tigela básica,
              um Colchonete e seu Diário Secreto. Trabalhe e jogue para mobiliar a casa!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
