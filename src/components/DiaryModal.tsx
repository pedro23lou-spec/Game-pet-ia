import React, { useEffect } from 'react';
import { AlertTriangle, BookLock, Eye, HeartHandshake, Lock, X } from 'lucide-react';
import type { DiaryEntry } from '../types/game';

export type DiaryViewPhase = 'choice' | 'refused' | 'reading_permitted' | 'reading_sneak' | 'caught';

interface DiaryModalProps {
  isOpen: boolean;
  phase: DiaryViewPhase;
  petName: string;
  affinity: number;
  entries: DiaryEntry[];
  onClose: () => void;
  onAskPermission: () => void;
  onSneakRead: () => void;
}

function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export const DiaryModal: React.FC<DiaryModalProps> = ({
  isOpen,
  phase,
  petName,
  affinity,
  entries,
  onClose,
  onAskPermission,
  onSneakRead,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#1B1612]/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Diário Secreto de ${petName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[85vh] bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5DDD0] bg-[#F5ECE8] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BookLock className="w-5 h-5 text-[#7C2D49]" />
            <div>
              <h2 className="font-display font-bold text-lg text-[#2B2520]">
                Diário Secreto de {petName}
              </h2>
              <p className="text-xs text-[#6C6054] tabular-nums">
                {entries.length} {entries.length === 1 ? 'página escrita' : 'páginas escritas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diário"
            className="p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#E5DDD0]/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          {phase === 'choice' && (
            <div className="space-y-4">
              <p className="text-sm text-[#4A4036] leading-relaxed">
                O caderno de couro de {petName} está fechado com um cadeado dourado. Como você
                quer tentar ler?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onAskPermission}
                  className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-white border border-[#DFD5C5] hover:border-emerald-600 text-left transition-all cursor-pointer"
                >
                  <HeartHandshake className="w-5 h-5 text-emerald-700" />
                  <div>
                    <p className="font-semibold text-sm text-[#2B2520]">Pedir para ler</p>
                    <p className="text-xs text-[#6C6054] mt-1">
                      Ele só aceita se a afinidade for 60 ou maior (atual: {Math.round(affinity)}).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onSneakRead}
                  className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-[#FFF6F6] border border-rose-200 hover:border-rose-500 text-left transition-all cursor-pointer"
                >
                  <Eye className="w-5 h-5 text-rose-700" />
                  <div>
                    <p className="font-semibold text-sm text-[#2B2520]">Ler escondido</p>
                    <p className="text-xs text-[#6C6054] mt-1">
                      Funciona se ele estiver em outro cômodo. Se chegar perto, você leva um flagra!
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {phase === 'refused' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-base text-[#2B2520]">
                {petName} segurou o diário com vergonha!
              </h3>
              <p className="text-sm text-[#5C5044] leading-relaxed">
                “Ei, ainda tenho vergonha de mostrar isso... converse e cuide de mim até nossa
                afinidade chegar a <strong>60</strong>! (Atual: {Math.round(affinity)}/60)”
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl bg-[#2B2520] text-[#FAF7F2] text-xs font-semibold cursor-pointer"
              >
                Entendi
              </button>
            </div>
          )}

          {phase === 'caught' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-rose-900">
                FLAGRA! {petName} pegou você lendo!
              </h3>
              <p className="text-sm text-[#4A4036] leading-relaxed">
                “Ei!! Isso é privado!” — {petName} fechou o diário na sua cara, perdeu confiança
                (<strong className="text-rose-700">-12 Afinidade</strong>) e ficou emburrado.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 cursor-pointer"
              >
                Fechar rápido
              </button>
            </div>
          )}

          {(phase === 'reading_permitted' || phase === 'reading_sneak') && (
            <div className="space-y-4">
              {phase === 'reading_sneak' ? (
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                  Lendo escondido... fique de olho! Se {petName} entrar no cômodo, ele vai te
                  pegar no flagra.
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                  {petName} sorriu e deixou você ler o diário dele com carinho!
                </div>
              )}

              {entries.length === 0 ? (
                <div className="text-center py-6 text-sm text-[#6C6054]">
                  As páginas ainda estão em branco. Logo {petName} vai vir aqui escrever o que
                  anda pensando sobre você!
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="bg-white border border-[#E5DDD0] rounded-2xl p-4 space-y-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-display font-bold text-sm text-[#2B2520]">
                          {entry.title}
                        </h4>
                        <span className="text-[11px] text-[#7A6E61] tabular-nums shrink-0">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-[#3E352D] italic leading-relaxed">
                        “{entry.content}”
                      </p>
                      <p className="text-[11px] text-[#7A6E61]">
                        Humor: {entry.mood} · Afinidade na época: {entry.affinityAtTime}/100
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
