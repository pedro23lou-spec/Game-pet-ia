import React, { useState, useRef, useEffect } from 'react';
import {
  BatteryCharging,
  Brain,
  ChevronDown,
  ChevronUp,
  Coins,
  FastForward,
  Frame,
  HeartPulse,
  Palette,
  Pencil,
  Settings,
  UserPlus,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { TimeOfDay, WeatherType } from '../types/game';

interface TopHudProps {
  petName: string;
  onChangePetName: (newName: string) => void;
  coins: number;
  hunger: number;
  energy: number;
  mentalEnergy: number;
  health: number;
  inspiration: number;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  onCycleWeather: () => void;
  clockText: string;
  timeScale: 1 | 2 | 5;
  onChangeTimeScale: (scale: 1 | 2 | 5) => void;
  galleryTotalCount: number;
  hasUnreadGallery: boolean;
  onOpenGallery: () => void;
  onOpenCreator: () => void;
  onOpenApiKeySettings: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const TIME_META: Record<TimeOfDay, { label: string; emoji: string }> = {
  day: { label: 'Dia', emoji: '☀️' },
  dusk: { label: 'Tarde', emoji: '🌅' },
  night: { label: 'Noite', emoji: '🌙' },
};

const WEATHER_META: Record<WeatherType, { label: string; emoji: string }> = {
  sunny: { label: 'Sol', emoji: '🌤️' },
  cloudy: { label: 'Nublado', emoji: '☁️' },
  rainy: { label: 'Chuva', emoji: '🌧️' },
};

export const TopHud: React.FC<TopHudProps> = ({
  petName,
  onChangePetName,
  coins,
  hunger,
  energy,
  mentalEnergy,
  health,
  inspiration,
  timeOfDay,
  weather,
  onCycleWeather,
  clockText,
  timeScale,
  onChangeTimeScale,
  galleryTotalCount,
  hasUnreadGallery,
  onOpenGallery,
  onOpenCreator,
  onOpenApiKeySettings,
  isMuted,
  onToggleMute,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(petName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(petName);
  }, [petName]);

  useEffect(() => {
    if (editingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingName]);

  const commitName = () => {
    const cleaned = draftName.trim().slice(0, 24);
    if (cleaned.length > 0) {
      onChangePetName(cleaned);
    } else {
      setDraftName(petName);
    }
    setEditingName(false);
  };

  const { label: timeLabel, emoji: timeEmoji } = TIME_META[timeOfDay];
  const { label: weatherLabel, emoji: weatherEmoji } = WEATHER_META[weather];

  const hungerPct = Math.round(hunger);
  const energyPct = Math.round(energy);
  const mentalPct = Math.round(mentalEnergy);
  const healthPct = Math.round(health);
  const inspPct = Math.round(inspiration);

  if (isCollapsed) {
    return (
      <div className="pointer-events-none fixed top-2.5 left-2.5 z-20">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expandir painel superior"
          title="Mostrar painel superior"
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F2]/88 backdrop-blur-md border border-[#DFD5C5] text-[#2B2520] text-xs font-semibold shadow-md hover:bg-[#FAF7F2] transition-colors cursor-pointer whitespace-nowrap"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span className="truncate max-w-[90px]">{petName}</span>
          <span className="text-[#7A6E61] tabular-nums">· {coins}</span>
          <span className="text-[#7A6E61] tabular-nums">
            · {timeEmoji} {clockText}
          </span>
          {hasUnreadGallery && (
            <span className="text-[11px] font-bold text-amber-700">· Nova!</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <header className="pointer-events-none fixed top-0 inset-x-0 z-20 p-2 sm:p-3.5 flex justify-center">
      <div className="pointer-events-auto w-full max-w-6xl bg-[#FAF7F2]/94 backdrop-blur-md border border-[#DFD5C5] shadow-[0_6px_24px_rgba(32,24,16,0.12)] rounded-2xl px-2.5 py-2 sm:px-4 sm:py-2.5 flex flex-col gap-2">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitName();
                }}
                className="flex items-center"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={draftName}
                  maxLength={24}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDraftName(petName);
                      setEditingName(false);
                    }
                  }}
                  aria-label="Nome do pet"
                  className="font-display font-bold text-sm sm:text-lg text-[#2B2520] bg-white border border-amber-500 rounded-lg px-2 py-0.5 w-24 sm:w-36 focus:outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                title="Clique para renomear seu pet"
                className="group flex items-center gap-1 text-left rounded-lg px-1 py-0.5 hover:bg-[#EFE8DC] transition-colors cursor-pointer min-w-0"
              >
                <span className="font-display font-bold text-sm sm:text-lg text-[#2B2520] truncate max-w-[66px] sm:max-w-[150px]">
                  {petName}
                </span>
                <Pencil className="w-3 h-3 text-[#8A7D6F] opacity-70 group-hover:opacity-100 shrink-0 hidden sm:inline" />
              </button>
            )}

            <div
              className="flex items-center gap-1 text-xs font-bold text-amber-800 whitespace-nowrap shrink-0 tabular-nums"
              title="Moedas disponíveis"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{coins}</span>
            </div>

            <div
              className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-[#EFE8DC]/90 border border-[#DFD5C5] text-[10px] sm:text-xs font-semibold text-[#5C5044] whitespace-nowrap shrink-0"
              title={`Horário real do dispositivo: ${timeLabel} · ${clockText}`}
            >
              <span aria-hidden="true">{timeEmoji}</span>
              <span className="hidden md:inline">{timeLabel}</span>
              <span className="tabular-nums text-[#2B2520]">{clockText}</span>
            </div>

            <button
              type="button"
              onClick={onCycleWeather}
              aria-label={`Clima: ${weatherLabel}. Clique para alternar`}
              title={`Clima no quintal: ${weatherLabel} (clique para testar outro clima)`}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg border text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                weather === 'rainy'
                  ? 'bg-sky-100/90 border-sky-300 text-sky-900 hover:bg-sky-200/80'
                  : weather === 'cloudy'
                    ? 'bg-slate-100/90 border-slate-300 text-slate-800 hover:bg-slate-200/80'
                    : 'bg-[#EFE8DC]/90 border-[#DFD5C5] text-[#5C5044] hover:bg-[#E6DCCB]'
              }`}
            >
              <span aria-hidden="true">{weatherEmoji}</span>
              <span className="hidden lg:inline">{weatherLabel}</span>
            </button>
          </div>

          {/* Right Action Cluster (fits 100% on 360px mobile) */}
          <div className="flex items-center gap-1 shrink-0">
            <div
              className="flex items-center bg-[#EFE8DC] p-0.5 rounded-xl border border-[#DFD5C5]"
              role="group"
              aria-label="Velocidade do tempo"
            >
              <span className="pl-1.5 pr-0.5 text-[11px] font-medium text-[#6C6054] hidden xl:inline-flex items-center gap-1 whitespace-nowrap">
                <FastForward className="w-3 h-3" />
                Tempo
              </span>
              {([1, 2, 5] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => onChangeTimeScale(scale)}
                  className={`px-1.5 py-1 text-[10px] sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    timeScale === scale
                      ? 'bg-[#2B2520] text-[#FAF7F2] shadow-xs'
                      : 'text-[#5C5044] hover:text-[#2B2520]'
                  }`}
                >
                  {scale}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenCreator}
              title="Novo Companheiro"
              className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl border border-[#DFD5C5] bg-[#FAF7F2] text-[#2B2520] hover:bg-[#EFE8DC] text-[10px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Novo Companheiro</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Ativar sons' : 'Silenciar sons'}
              title={isMuted ? 'Ativar sons' : 'Silenciar sons'}
              className="p-1.5 sm:p-2 rounded-xl border border-[#DFD5C5] bg-[#FAF7F2] text-[#5C5044] hover:bg-[#EFE8DC] hover:text-[#2B2520] transition-colors cursor-pointer shrink-0"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenGallery}
              className={`flex items-center gap-1 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                hasUnreadGallery
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm hover:bg-amber-700'
                  : 'bg-[#2B2520] text-[#FAF7F2] border-[#2B2520] hover:bg-[#3D352E]'
              }`}
            >
              <Frame className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden min-[400px]:inline">Galeria</span>
              <span className="tabular-nums opacity-85">({galleryTotalCount})</span>
            </button>

            <button
              type="button"
              onClick={onOpenApiKeySettings}
              aria-label="Configurar chave da API Gemini"
              title="Configurar chave da API Gemini"
              className="p-1.5 sm:p-2 rounded-xl border border-[#DFD5C5] bg-[#FAF7F2] text-[#5C5044] hover:bg-[#EFE8DC] hover:text-[#2B2520] transition-colors cursor-pointer shrink-0"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Minimizar painel superior"
              title="Minimizar painel superior"
              className="p-1.5 sm:p-2 rounded-xl border border-[#DFD5C5] bg-[#FAF7F2] text-[#5C5044] hover:bg-[#EFE8DC] hover:text-[#2B2520] transition-colors cursor-pointer shrink-0"
            >
              <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* 5 Status Bars: Fome, Energia, Mental, Saúde, Inspiração */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-2.5 gap-y-1.5 pt-1 border-t border-[#E5DDD0]/80">
          <NeedMeter
            label="Fome"
            value={hungerPct}
            Icon={Utensils}
            barColor={hungerPct < 35 ? 'bg-rose-500' : 'bg-emerald-600'}
            isWarning={hungerPct < 35}
          />
          <NeedMeter
            label="Energia"
            value={energyPct}
            Icon={BatteryCharging}
            barColor={energyPct < 30 ? 'bg-amber-500' : 'bg-sky-600'}
            isWarning={energyPct < 30}
          />
          <NeedMeter
            label="Mental"
            value={mentalPct}
            Icon={Brain}
            barColor={mentalPct <= 15 ? 'bg-rose-500' : 'bg-teal-600'}
            isWarning={mentalPct <= 15}
          />
          <NeedMeter
            label="Saúde"
            value={healthPct}
            Icon={HeartPulse}
            barColor={healthPct < 40 ? 'bg-rose-500' : 'bg-lime-600'}
            isWarning={healthPct < 40}
          />
          <NeedMeter
            label="Inspiração"
            value={inspPct}
            Icon={Palette}
            barColor="bg-amber-600"
            isWarning={false}
          />
        </div>
      </div>
    </header>
  );
};

interface NeedMeterProps {
  label: string;
  value: number;
  Icon: React.FC<{ className?: string }>;
  barColor: string;
  isWarning: boolean;
}

const NeedMeter: React.FC<NeedMeterProps> = ({ label, value, Icon, barColor, isWarning }) => {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-semibold">
        <span
          className={`flex items-center gap-1 whitespace-nowrap truncate ${
            isWarning ? 'text-rose-700' : 'text-[#5C5044]'
          }`}
        >
          <Icon className="w-3 h-3 shrink-0" />
          {label}
        </span>
        <span className={`tabular-nums shrink-0 ${isWarning ? 'text-rose-700' : 'text-[#2B2520]'}`}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-[#E5DDD0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
};
