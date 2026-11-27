import React, { useEffect, useState } from 'react';

interface PetRadialMenuProps {
  isOpen: boolean;
  openedAtTimestamp: number;
  petName: string;
  screenX: number;
  screenY: number;
  isGrumpy: boolean;
  lastPetTime: number;
  lastPraiseTime: number;
  petCooldownMs: number;
  praiseCooldownMs: number;
  onPet: () => void;
  onPraise: () => void;
  onChat: () => void;
  onClose: () => void;
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export const PetRadialMenu: React.FC<PetRadialMenuProps> = ({
  isOpen,
  openedAtTimestamp,
  petName,
  screenX,
  screenY,
  isGrumpy,
  lastPetTime,
  lastPraiseTime,
  petCooldownMs,
  praiseCooldownMs,
  onPet,
  onPraise,
  onChat,
  onClose,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(interval);
  }, [isOpen, lastPetTime, lastPraiseTime]);

  if (!isOpen || typeof window === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = Math.max(165, Math.min(vw - 165, screenX));
  const cy = Math.max(130, Math.min(vh - 125, screenY));

  const petRemainingMs =
    lastPetTime > 0 ? Math.max(0, petCooldownMs - (nowMs - lastPetTime)) : 0;
  const praiseRemainingMs =
    lastPraiseTime > 0 ? Math.max(0, praiseCooldownMs - (nowMs - lastPraiseTime)) : 0;

  const petDisabled = petRemainingMs > 0;
  const praiseDisabled = praiseRemainingMs > 0;

  const handleBackdropEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (Date.now() - openedAtTimestamp < 300) {
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Transparent backdrop click to dismiss after 300ms grace period */}
      <button
        type="button"
        aria-label="Fechar menu do pet"
        onPointerDown={handleBackdropEvent}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={handleBackdropEvent}
        className="pointer-events-auto fixed inset-0 z-0 w-full h-full bg-transparent cursor-default"
      />

      <div
        role="menu"
        aria-label={`Interagir com ${petName}`}
        style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)' }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-none fixed z-10 w-[320px] h-[200px]"
      >
        {/* Subtle radial anchor ring around pet */}
        <div
          aria-hidden="true"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          className="absolute w-28 h-28 rounded-full border-2 border-dashed border-amber-300/75 bg-amber-100/10"
        />

        {/* Top-left radial option: Carinho */}
        <button
          type="button"
          disabled={petDisabled}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (!petDisabled) onPet();
          }}
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(calc(-50% - 82px), calc(-50% - 62px))',
          }}
          className={`pointer-events-auto absolute flex items-center gap-1.5 px-3 py-2 rounded-2xl border shadow-lg text-xs font-semibold whitespace-nowrap transition-colors tabular-nums ${
            petDisabled
              ? 'bg-[#EFE8DC]/95 border-[#D5C9B6] text-[#7A6E61] opacity-90 cursor-not-allowed'
              : 'bg-[#FAF7F2]/98 backdrop-blur-md border-[#DFD5C5] text-[#2B2520] hover:bg-rose-50 hover:border-rose-300 cursor-pointer'
          }`}
        >
          <span aria-hidden="true">🤗</span>
          <span>{petDisabled ? `Carinho (${formatCountdown(petRemainingMs)})` : 'Carinho'}</span>
        </button>

        {/* Top-right radial option: Elogiar */}
        <button
          type="button"
          disabled={praiseDisabled}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (!praiseDisabled) onPraise();
          }}
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(calc(-50% + 82px), calc(-50% - 62px))',
          }}
          className={`pointer-events-auto absolute flex items-center gap-1.5 px-3 py-2 rounded-2xl border shadow-lg text-xs font-semibold whitespace-nowrap transition-colors tabular-nums ${
            praiseDisabled
              ? 'bg-[#EFE8DC]/95 border-[#D5C9B6] text-[#7A6E61] opacity-90 cursor-not-allowed'
              : 'bg-[#FAF7F2]/98 backdrop-blur-md border-[#DFD5C5] text-[#2B2520] hover:bg-amber-50 hover:border-amber-300 cursor-pointer'
          }`}
        >
          <span aria-hidden="true">👋</span>
          <span>
            {praiseDisabled ? `Elogiar (${formatCountdown(praiseRemainingMs)})` : 'Elogiar'}
          </span>
        </button>

        {/* Bottom radial option: Conversar */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onChat();
          }}
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, calc(-50% + 66px))',
          }}
          className="pointer-events-auto absolute flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#2B2520] text-[#FAF7F2] border border-[#2B2520] shadow-lg text-xs font-semibold hover:bg-[#3D352E] transition-colors cursor-pointer whitespace-nowrap"
        >
          <span aria-hidden="true">💬</span>
          <span>Conversar</span>
        </button>

        {isGrumpy && (
          <div
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, calc(-50% - 104px))',
            }}
            className="pointer-events-none absolute px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-[10px] font-semibold text-rose-700 shadow-xs whitespace-nowrap"
          >
            {petName} está emburrado
          </div>
        )}
      </div>
    </div>
  );
};
