import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Send, User, X } from 'lucide-react';
import type { ChatMessage, PetTraits, TraitKey } from '../types/game';
import {
  formatBatteryTimer,
  formatHoursMinutes,
  getFullRechargeMs,
} from '../services/socialBattery';

interface ChatDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  petName: string;
  mood: string;
  affinity: number;
  traits: PetTraits;
  socialBattery: number;
  socialBatteryMax: number;
  socialBatteryNextRechargeMs: number;
  messages: ChatMessage[];
  isSending: boolean;
  errorMessage?: string | null;
  onDismissError?: () => void;
  onSendMessage: (text: string) => void;
  bottomBarCollapsed: boolean;
}

const TRAIT_META: Array<{ key: TraitKey; label: string }> = [
  { key: 'curioso', label: 'Curioso' },
  { key: 'nerd', label: 'Nerd' },
  { key: 'filosofo', label: 'Filósofo' },
  { key: 'artistico', label: 'Artístico' },
  { key: 'carinhoso', label: 'Carinhoso' },
  { key: 'trabalhador', label: 'Trabalhador' },
  { key: 'preguicoso', label: 'Preguiçoso' },
];

function getAffinityLabel(affinity: number): string {
  if (affinity >= 80) return 'Melhor Amigo';
  if (affinity >= 60) return 'Confiança Alta';
  if (affinity >= 40) return 'Amigável';
  return 'Emburrado';
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onToggleOpen,
  petName,
  mood,
  affinity,
  traits,
  socialBattery,
  socialBatteryMax,
  socialBatteryNextRechargeMs,
  messages,
  isSending,
  errorMessage,
  onDismissError,
  onSendMessage,
  bottomBarCollapsed,
}) => {
  const [inputText, setInputText] = useState('');
  const [showProfile, setShowProfile] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length, isSending]);

  const isBatteryDepleted = socialBattery <= 0;
  const isBatteryRecharging = socialBattery < socialBatteryMax;
  const nextPointTimer = formatBatteryTimer(socialBatteryNextRechargeMs);
  const fullRechargeText = formatHoursMinutes(
    getFullRechargeMs(socialBattery, socialBatteryNextRechargeMs, socialBatteryMax)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending || isBatteryDepleted) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  if (!isOpen) {
    return (
      <div
        className={`pointer-events-none fixed right-3 z-25 transition-all ${
          bottomBarCollapsed ? 'bottom-2.5' : 'bottom-24 sm:bottom-20'
        }`}
      >
        <button
          type="button"
          onClick={onToggleOpen}
          className={`pointer-events-auto flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border shadow-lg transition-colors cursor-pointer text-xs font-semibold whitespace-nowrap ${
            isBatteryDepleted
              ? 'bg-[#2B2520] text-[#FAF7F2] border-rose-400/70 hover:bg-[#3E362F]'
              : 'bg-[#2B2520] text-[#FAF7F2] border-[#433A32] hover:bg-[#3E362F]'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-amber-300 shrink-0" />
          <span>Conversar</span>
          <span className="text-[#9E9284]" aria-hidden="true">
            ·
          </span>
          <span
            className={`tabular-nums ${
              isBatteryDepleted ? 'text-rose-300' : 'text-amber-200'
            }`}
          >
            ⚡ {socialBattery}/{socialBatteryMax}
            {isBatteryRecharging && (
              <span className="ml-1 text-[11px] text-[#D8CEC1] font-medium">
                (+1 em {nextPointTimer})
              </span>
            )}
          </span>
        </button>
      </div>
    );
  }

  const affinityRounded = Math.round(affinity);

  return (
    <aside
      aria-label={`Chat com ${petName}`}
      className="fixed bottom-3 right-3 left-3 sm:left-auto sm:w-[400px] h-[72vh] max-h-[560px] z-35 bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-3.5 py-3 border-b border-[#E5DDD0] flex items-center justify-between gap-2 bg-[#F5EFE6]">
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold text-sm sm:text-base text-[#2B2520] truncate">
            Conversar com {petName}
          </h2>
          <p className="text-[11px] text-[#6C6054] truncate">Humor: {mood}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`px-2 py-1 rounded-xl border text-[10px] sm:text-[11px] font-semibold tabular-nums whitespace-nowrap inline-flex items-center gap-1 ${
              isBatteryDepleted
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-white border-[#DFD5C5] text-[#2B2520]'
            }`}
            title={
              isBatteryRecharging
                ? `Bateria Social: recarrega +1 ⚡ em ${nextPointTimer}`
                : 'Bateria Social cheia (10/10)'
            }
          >
            <span aria-hidden="true">⚡</span>
            <span>
              {socialBattery}/{socialBatteryMax}
            </span>
            {isBatteryRecharging && (
              <span className={isBatteryDepleted ? 'text-rose-700' : 'text-[#6C6054]'}>
                (+1 em {nextPointTimer})
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowProfile((p) => !p)}
            title="Ver perfil e personalidade"
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 border ${
              showProfile
                ? 'bg-[#2B2520] text-[#FAF7F2] border-[#2B2520]'
                : 'bg-white text-[#5C5044] border-[#DFD5C5] hover:bg-[#EFE8DC]'
            }`}
          >
            <User className="w-3 h-3" />
            <span>Perfil</span>
          </button>
          <button
            type="button"
            onClick={onToggleOpen}
            aria-label="Fechar chat"
            className="p-1.5 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#E5DDD0]/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mini Pet Profile Card: Affinity + Personality Traits */}
      {showProfile && (
        <div className="px-4 py-3 bg-[#F9F5EE] border-b border-[#E5DDD0] space-y-2.5 shrink-0">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="inline-flex items-center gap-1 text-[#2B2520]">
                <Heart className="w-3.5 h-3.5 text-rose-600" />
                Afinidade · {getAffinityLabel(affinityRounded)}
              </span>
              <span className="tabular-nums text-[#2B2520]">{affinityRounded}/100</span>
            </div>
            <div className="h-1.5 w-full bg-[#E5DDD0] rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(4, Math.min(100, affinityRounded))}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5C5044]">
            {TRAIT_META.map((t, idx) => (
              <React.Fragment key={t.key}>
                <span className="whitespace-nowrap">
                  {t.label}{' '}
                  <strong className="tabular-nums text-[#2B2520]">
                    {Math.round(traits[t.key])}
                  </strong>
                </span>
                {idx < TRAIT_META.length - 1 && (
                  <span aria-hidden="true" className="text-[#C8BCB0]">
                    ·
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
            <p className="text-sm font-semibold text-[#2B2520]">
              Diga oi para {petName}!
            </p>
            <p className="text-xs text-[#6C6054] leading-relaxed">
              Ele lembra das pinturas, das pesquisas na internet, de como você cuida dele e até do
              que acontece no diário.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#2B2520] text-[#FAF7F2]'
                    : 'bg-white border border-[#E5DDD0] text-[#2B2520]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#E5DDD0] text-[#7A6E61] rounded-2xl px-3.5 py-2 text-xs italic">
              {petName} está pensando...
            </div>
          </div>
        )}

        {errorMessage && !isSending && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl px-3.5 py-2.5 text-xs flex items-start justify-between gap-2"
          >
            <span className="leading-relaxed">{errorMessage}</span>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="text-rose-700 font-semibold hover:underline cursor-pointer shrink-0"
              >
                Fechar
              </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar OR Rest Card when Social Battery is 0/10 */}
      {isBatteryDepleted ? (
        <div
          role="status"
          className="p-3.5 border-t border-[#E5DDD0] bg-[#F5EFE6] shrink-0"
        >
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-3 text-[#2B2520] space-y-1.5 shadow-xs">
            <p className="font-display font-bold text-sm text-amber-950">
              {petName} precisa descansar a mente 💤
            </p>
            <p className="text-xs text-[#4B3F33] leading-relaxed">
              Sua energia de conversa acabou. Volte daqui a{' '}
              <strong className="tabular-nums text-amber-950">{fullRechargeText}</strong> para
              recarregar tudo (ou aguarde{' '}
              <strong className="tabular-nums text-amber-950">{nextPointTimer}</strong> para
              ganhar +1 ⚡) e continuar subindo a afinidade.
            </p>
            <p className="text-[11px] font-medium text-amber-900/90 pt-0.5">
              Enquanto espera, você pode alimentar, trabalhar ou cuidar da horta!
            </p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="p-3 border-t border-[#E5DDD0] bg-[#FAF7F2] flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Fale com ${petName}... (1 ⚡)`}
            maxLength={300}
            className="flex-1 min-w-0 bg-white border border-[#DFD5C5] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2B2520] placeholder:text-[#9A8E80] focus:outline-none focus:border-amber-600"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            aria-label="Enviar mensagem"
            className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      )}
    </aside>
  );
};
