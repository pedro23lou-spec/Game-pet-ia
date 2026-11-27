import React from 'react';
import { AlertTriangle, Briefcase, Clock, Coins, X } from 'lucide-react';
import type { PetTraits, WorkGig } from '../types/game';
import { WORK_GIGS } from '../world/mapData';

interface WorkGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  petName: string;
  hunger: number;
  energy: number;
  affinity: number;
  isAlreadyWorking: boolean;
  workCount: number;
  traits: PetTraits;
  onSelectGig: (gig: WorkGig) => void;
}

export const WorkGateModal: React.FC<WorkGateModalProps> = ({
  isOpen,
  onClose,
  petName,
  hunger,
  energy,
  affinity,
  isAlreadyWorking,
  workCount,
  traits,
  onSelectGig,
}) => {
  if (!isOpen) return null;

  const isGrumpy = affinity < 40;
  const isLowNeeds = hunger < 30 || energy < 30;

  const habitText =
    traits.trabalhador >= 45
      ? `${petName} criou rotina de trabalho e já vai sozinho quando faltam moedas!`
      : traits.preguicoso >= 45
        ? `${petName} está com perfil Preguiçoso (${Math.round(traits.preguicoso)}/100) e pode reclamar.`
        : `Incentive ${petName} a trabalhar para formar o hábito Trabalhador.`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#1B1612]/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Portão de Trabalho"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E5DDD0] bg-[#F5EFE6] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-5 h-5 text-amber-700" />
            <div>
              <h2 className="font-display font-bold text-lg text-[#2B2520]">
                Portão da Cidade · Bicos
              </h2>
              <p className="text-xs text-[#6C6054] tabular-nums">
                Bicos realizados: {workCount} · Trabalhador {Math.round(traits.trabalhador)} ·
                Preguiçoso {Math.round(traits.preguicoso)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#E5DDD0]/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <p className="text-xs text-[#4A4036] bg-[#F3ECE1] border border-[#E5DDD0] rounded-xl px-3.5 py-2.5 leading-relaxed">
            {habitText}
          </p>

          {isGrumpy && (
            <div className="flex items-start gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>
                <strong>{petName} está emburrado</strong> (Afinidade {Math.round(affinity)}/100) e
                vai recusar trabalhar até você reconquistar a confiança dele com comida ou atenção.
              </span>
            </div>
          )}

          {!isGrumpy && isLowNeeds && (
            <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Cuidado:</strong> Fome ({Math.round(hunger)}%) ou Energia (
                {Math.round(energy)}%) está abaixo de 30%. Mandá-lo trabalhar agora reduz a Afinidade!
              </span>
            </div>
          )}

          {isAlreadyWorking ? (
            <div className="text-center py-6 text-sm text-[#4A4036]">
              {petName} já está trabalhando na cidade neste momento! Aguarde ele voltar pelo portão.
            </div>
          ) : (
            <div className="space-y-2.5">
              {WORK_GIGS.map((gig) => (
                <div
                  key={gig.id}
                  className="bg-white border border-[#E5DDD0] rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#2B2520]">
                      {gig.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#6C6054] flex-wrap tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {gig.durationSec}s
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <Coins className="w-3 h-3" />+{gig.rewardCoins} moedas
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>-{gig.energyCost} Energia</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectGig(gig)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      isGrumpy
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                        : 'bg-[#2B2520] text-[#FAF7F2] hover:bg-[#3E352D]'
                    }`}
                  >
                    {isGrumpy ? 'Tentar Enviar' : 'Enviar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
