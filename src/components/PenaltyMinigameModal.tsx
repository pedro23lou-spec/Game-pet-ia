import React, { useEffect, useRef, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import type { PetAppearance } from '../types/game';
import { drawPetCharacter } from '../world/canvasRenderer';
import { soundFx } from '../world/soundFx';

interface PenaltyMinigameModalProps {
  isOpen: boolean;
  petName: string;
  appearance: PetAppearance;
  onClose: () => void;
  onComplete: (result: { goals: number; saves: number; maxKicks: number }) => void;
}

const MAX_KICKS = 5;

interface GoalTarget {
  id: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
}

const GOAL_TARGETS: GoalTarget[] = [
  { id: 'top-left', label: 'Canto Superior Esquerdo', shortLabel: 'Sup. Esq.', x: 94, y: 58 },
  { id: 'bot-left', label: 'Inferior Esquerdo', shortLabel: 'Inf. Esq.', x: 94, y: 102 },
  { id: 'center', label: 'Centro', shortLabel: 'Centro', x: 180, y: 76 },
  { id: 'top-right', label: 'Canto Superior Direito', shortLabel: 'Sup. Dir.', x: 266, y: 58 },
  { id: 'bot-right', label: 'Inferior Direito', shortLabel: 'Inf. Dir.', x: 266, y: 102 },
];

export const PenaltyMinigameModal: React.FC<PenaltyMinigameModalProps> = ({
  isOpen,
  petName,
  appearance,
  onClose,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [kickNumber, setKickNumber] = useState(1);
  const [goals, setGoals] = useState(0);
  const [saves, setSaves] = useState(0);
  const [banner, setBanner] = useState('Escolha um dos 5 alvos ou clique dentro do gol!');
  const [finished, setFinished] = useState(false);

  const hoverAimRef = useRef<{ x: number; y: number; targetId: string | null } | null>(null);

  const animRef = useRef<{
    kicking: boolean;
    progress: number;
    targetX: number;
    targetY: number;
    keeperStartX: number;
    keeperStartY: number;
    keeperTargetX: number;
    keeperTargetY: number;
    outcomeHandled: boolean;
  }>({
    kicking: false,
    progress: 0,
    targetX: 180,
    targetY: 76,
    keeperStartX: 180,
    keeperStartY: 102,
    keeperTargetX: 180,
    keeperTargetY: 102,
    outcomeHandled: false,
  });

  const roundStateRef = useRef({ kickNumber: 1, goals: 0, saves: 0, finished: false });
  roundStateRef.current = { kickNumber, goals, saves, finished };

  useEffect(() => {
    if (isOpen) {
      setKickNumber(1);
      setGoals(0);
      setSaves(0);
      setFinished(false);
      setBanner('Escolha um dos 5 alvos ou clique dentro do gol!');
      hoverAimRef.current = null;
      animRef.current = {
        kicking: false,
        progress: 0,
        targetX: 180,
        targetY: 76,
        keeperStartX: 180,
        keeperStartY: 102,
        keeperTargetX: 180,
        keeperTargetY: 102,
        outcomeHandled: false,
      };
    }
  }, [isOpen]);

  const shootAt = (aimX: number, aimY: number) => {
    if (finished || animRef.current.kicking) return;
    const clampedX = Math.max(76, Math.min(284, aimX));
    const clampedY = Math.max(46, Math.min(114, aimY));

    const keeperChoice = GOAL_TARGETS[Math.floor(Math.random() * GOAL_TARGETS.length)];

    soundFx.playKick();
    animRef.current = {
      kicking: true,
      progress: 0,
      targetX: clampedX,
      targetY: clampedY,
      keeperStartX: 180,
      keeperStartY: 102,
      keeperTargetX: keeperChoice.x,
      keeperTargetY: keeperChoice.y <= 70 ? 84 : 104,
      outcomeHandled: false,
    };
  };

  useEffect(() => {
    if (!isOpen) return;
    let animId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;

      const anim = animRef.current;
      if (anim.kicking) {
        anim.progress = Math.min(1, anim.progress + dt * 2.1);
        if (anim.progress >= 1 && !anim.outcomeHandled) {
          anim.outcomeHandled = true;
          const distToKeeper = Math.hypot(
            anim.targetX - anim.keeperTargetX,
            (anim.targetY - anim.keeperTargetY) * 0.85
          );
          const isSave = distToKeeper < 34;

          const nextGoals = roundStateRef.current.goals + (isSave ? 0 : 1);
          const nextSaves = roundStateRef.current.saves + (isSave ? 1 : 0);

          if (isSave) {
            setSaves(nextSaves);
            setBanner(`${petName} defendeu! Que reflexo!`);
            soundFx.playSave();
          } else {
            setGoals(nextGoals);
            setBanner('GOOOL!! Belo chute!');
            soundFx.playGoal();
          }

          window.setTimeout(() => {
            if (roundStateRef.current.kickNumber >= MAX_KICKS) {
              setFinished(true);
            } else {
              setKickNumber((k) => k + 1);
              setBanner('Próximo chute! Escolha onde mirar no gol.');
              anim.kicking = false;
              anim.progress = 0;
              anim.keeperStartX = 180;
              anim.keeperStartY = 102;
              anim.keeperTargetX = 180;
              anim.keeperTargetY = 102;
            }
          }, 750);
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const w = 360;
          const h = 250;
          if (canvas.width !== w * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
          }
          ctx.save();
          ctx.scale(dpr, dpr);

          // Pitch grass
          ctx.fillStyle = '#5FA35D';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#6DB36F';
          ctx.fillRect(0, 0, w, 130);

          // Penalty box lines
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(42, 48, 276, 100);

          // Goal frame & net
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(68, 38, 224, 82);
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.lineWidth = 1;
          for (let gx = 68; gx <= 292; gx += 16) {
            ctx.beginPath();
            ctx.moveTo(gx, 38);
            ctx.lineTo(gx, 120);
            ctx.stroke();
          }
          for (let gy = 38; gy <= 120; gy += 16) {
            ctx.beginPath();
            ctx.moveTo(68, gy);
            ctx.lineTo(292, gy);
            ctx.stroke();
          }
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(68, 120);
          ctx.lineTo(68, 38);
          ctx.lineTo(292, 38);
          ctx.lineTo(292, 120);
          ctx.stroke();

          // 5 clickable aim targets inside the goal (visible before kick)
          if (!anim.kicking) {
            const hoverAim = hoverAimRef.current;
            for (const target of GOAL_TARGETS) {
              const isHovered = hoverAim?.targetId === target.id;
              const pulse = 1 + Math.sin(t * 4) * 0.08;
              const r = (isHovered ? 13 : 10.5) * pulse;

              ctx.fillStyle = isHovered ? 'rgba(251, 191, 36, 0.48)' : 'rgba(255, 255, 255, 0.24)';
              ctx.beginPath();
              ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
              ctx.fill();

              ctx.strokeStyle = isHovered ? '#FDE047' : 'rgba(255, 255, 255, 0.85)';
              ctx.lineWidth = isHovered ? 2.4 : 1.6;
              ctx.beginPath();
              ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = isHovered ? '#FEF08A' : '#FFFFFF';
              ctx.beginPath();
              ctx.arc(target.x, target.y, 2.8, 0, Math.PI * 2);
              ctx.fill();
            }

            // Free aim crosshair + dashed trajectory line when hovering inside the goal
            if (hoverAim) {
              ctx.save();
              ctx.setLineDash([5, 5]);
              ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(180, 212);
              ctx.lineTo(hoverAim.x, hoverAim.y);
              ctx.stroke();
              ctx.restore();

              if (!hoverAim.targetId) {
                ctx.strokeStyle = '#FDE047';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(hoverAim.x, hoverAim.y, 9, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
          }

          // Pet Goalkeeper
          const keeperX = anim.kicking
            ? anim.keeperStartX + (anim.keeperTargetX - anim.keeperStartX) * anim.progress
            : 180 + Math.sin(t * 2.5) * 18;
          const keeperY = anim.kicking
            ? anim.keeperStartY + (anim.keeperTargetY - anim.keeperStartY) * anim.progress
            : 102;
          drawPetCharacter({
            ctx,
            x: keeperX,
            y: keeperY,
            appearance,
            timeSec: t,
            scale: 1.05,
            isLookingAtScreen: true,
            isCalling: anim.kicking && anim.progress >= 1,
          });

          // Soccer Ball
          const startX = 180;
          const startY = 212;
          const bx = anim.kicking
            ? startX + (anim.targetX - startX) * anim.progress
            : startX;
          const arcLift = anim.kicking ? Math.sin(anim.progress * Math.PI) * 28 : 0;
          const by = anim.kicking
            ? startY + (anim.targetY - startY) * anim.progress - arcLift
            : startY;
          const bScale = anim.kicking ? 1 - anim.progress * 0.35 : 1;

          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.ellipse(bx, by + 12 * bScale, 12 * bScale, 5 * bScale, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(bx, by, 12 * bScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#1E293B';
          ctx.beginPath();
          ctx.arc(bx, by, 4 * bScale, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      animId = window.requestAnimationFrame(loop);
    };

    animId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(animId);
  }, [isOpen, appearance, petName]);

  if (!isOpen) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 360 / rect.width;
    const scaleY = 250 / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const resolveGoalAim = (rawX: number, rawY: number) => {
    for (const target of GOAL_TARGETS) {
      if (Math.hypot(rawX - target.x, rawY - target.y) <= 17) {
        return { x: target.x, y: target.y, targetId: target.id };
      }
    }
    const clampedX = Math.max(74, Math.min(286, rawX));
    const clampedY = Math.max(44, Math.min(116, rawY));
    return { x: clampedX, y: clampedY, targetId: null };
  };

  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (finished || animRef.current.kicking) {
      hoverAimRef.current = null;
      return;
    }
    const pt = getCanvasPoint(e);
    if (pt.x >= 60 && pt.x <= 300 && pt.y >= 32 && pt.y <= 130) {
      hoverAimRef.current = resolveGoalAim(pt.x, pt.y);
    } else {
      hoverAimRef.current = null;
    }
  };

  const handleCanvasClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (finished || animRef.current.kicking) return;
    const pt = getCanvasPoint(e);
    const resolved = resolveGoalAim(pt.x, pt.y);
    shootAt(resolved.x, resolved.y);
  };

  const perfectDefense = saves === MAX_KICKS && goals === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B1612]/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Minigame de Pênaltis"
    >
      <div className="w-full max-w-md bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-[#E5DDD0] bg-[#F5EFE6] flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg text-[#2B2520]">
              Pênaltis com {petName}
            </h2>
            <p className="text-xs text-[#6C6054] tabular-nums">
              Chute {kickNumber}/{MAX_KICKS} · Gols: {goals} · Defesas: {saves}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar minigame"
            className="p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center gap-3">
          {!finished ? (
            <>
              <canvas
                ref={canvasRef}
                onPointerMove={handleCanvasMove}
                onPointerLeave={() => {
                  hoverAimRef.current = null;
                }}
                onPointerDown={handleCanvasClick}
                className="w-full max-w-[360px] aspect-[360/250] rounded-2xl border-2 border-[#4D7C0F] cursor-crosshair touch-none"
              />
              <div className="w-full flex flex-wrap items-center justify-center gap-1.5">
                {GOAL_TARGETS.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    disabled={animRef.current.kicking}
                    onClick={() => shootAt(target.x, target.y)}
                    title={`Chutar em: ${target.label}`}
                    className="px-2.5 py-1 rounded-lg bg-[#EFE8DC] hover:bg-[#E2D8C8] text-[#2B2520] text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {target.shortLabel}
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold text-[#2B2520] text-center">{banner}</p>
            </>
          ) : (
            <div className="py-6 px-3 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#2B2520]">
                {perfectDefense ? `${petName} fechou o gol!!` : 'Fim de Partida!'}
              </h3>
              <p className="text-sm text-[#4A4036] tabular-nums">
                Você marcou <strong>{goals}</strong> gols e {petName} fez{' '}
                <strong>{saves}</strong> defesas!
              </p>
              <p className="text-xs font-semibold text-emerald-700 tabular-nums">
                Recompensa: +18 Saúde · +16 Felicidade · +{perfectDefense ? 14 : 10} Afinidade
              </p>
              {perfectDefense && (
                <p className="text-[11px] text-amber-800">
                  {petName} defendeu todos os chutes e foi comemorar no Chat!
                </p>
              )}
              <button
                type="button"
                onClick={() => onComplete({ goals, saves, maxKicks: MAX_KICKS })}
                className="mt-2 px-5 py-2.5 rounded-xl bg-[#2B2520] text-[#FAF7F2] text-xs font-semibold hover:bg-[#3E352D] cursor-pointer"
              >
                Concluir Partida
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
