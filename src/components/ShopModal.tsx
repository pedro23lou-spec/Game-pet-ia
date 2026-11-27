import React, { useState } from 'react';
import {
  BedDouble,
  BookLock,
  Brush,
  CircleDot,
  Coins,
  Cookie,
  Monitor,
  Refrigerator,
  Sprout,
  Utensils,
  X,
} from 'lucide-react';
import type { FurnitureType, SeedType } from '../types/game';
import { FURNITURE_CATALOG, SEED_CATALOG } from '../world/mapData';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
  hasFridge: boolean;
  onBuyFurniture: (type: FurnitureType) => void;
  onBuyRefill: () => void;
  onBuyTreat: () => void;
  onBuySeed: (seed: SeedType) => void;
}

type ShopTab = 'furniture' | 'food' | 'garden';

const FURNITURE_FOR_SALE: Array<{
  type: FurnitureType;
  Icon: React.FC<{ className?: string }>;
}> = [
  { type: 'easel', Icon: Brush },
  { type: 'computer', Icon: Monitor },
  { type: 'bed', Icon: BedDouble },
  { type: 'ball', Icon: CircleDot },
  { type: 'fridge', Icon: Refrigerator },
  { type: 'diary', Icon: BookLock },
];

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  coins,
  hasFridge,
  onBuyFurniture,
  onBuyRefill,
  onBuyTreat,
  onBuySeed,
}) => {
  const [tab, setTab] = useState<ShopTab>('furniture');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[#1B1612]/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Loja da Casa"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[88vh] bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5DDD0] flex flex-wrap items-center justify-between gap-3 bg-[#F5EFE6]">
          <div>
            <h2 className="font-display font-bold text-lg sm:text-xl text-[#2B2520]">
              Loja da Vizinhança
            </h2>
            <p className="text-xs text-[#6C6054] flex items-center gap-1.5 mt-0.5">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>
                Saldo disponível:{' '}
                <strong className="tabular-nums text-[#2B2520]">{coins} moedas</strong>
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar loja"
            className="p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#E5DDD0]/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-[#E5DDD0] flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'furniture', label: 'Móveis & Lazer' },
              { id: 'food', label: 'Comida' },
              { id: 'garden', label: 'Jardinagem' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-[#2B2520] text-[#FAF7F2]'
                  : 'bg-[#EFE8DC] text-[#5C5044] hover:text-[#2B2520]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Store Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'furniture' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FURNITURE_FOR_SALE.map(({ type, Icon }) => {
                const info = FURNITURE_CATALOG[type];
                const canAfford = coins >= info.price;
                return (
                  <div
                    key={type}
                    className="bg-white border border-[#E5DDD0] rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F3ECE1] text-[#2B2520] flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-[#2B2520]">
                          {info.name}
                        </h3>
                        <p className="text-xs text-[#6C6054] mt-1 leading-relaxed">
                          {info.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#F0E9DE]">
                      <span className="text-xs font-bold text-amber-800 tabular-nums">
                        {info.price} moedas
                      </span>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuyFurniture(type)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        Comprar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'food' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#2B2520]">
                      Reabastecer Geladeira (+4)
                    </h3>
                    <p className="text-xs text-[#6C6054] mt-1 leading-relaxed">
                      Enche a sua Geladeira / Tigela com 4 porções completas de ração.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#F0E9DE]">
                  <span className="text-xs font-bold text-amber-800 tabular-nums">15 moedas</span>
                  <button
                    type="button"
                    disabled={coins < 15 || !hasFridge}
                    onClick={onBuyRefill}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {hasFridge ? 'Reabastecer' : 'Sem geladeira'}
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <Cookie className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#2B2520]">
                      Petisco Natural Saudável
                    </h3>
                    <p className="text-xs text-[#6C6054] mt-1 leading-relaxed">
                      Dá direto na boca: +25 Fome, +10 Saúde e +4 Afinidade na hora!
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#F0E9DE]">
                  <span className="text-xs font-bold text-amber-800 tabular-nums">10 moedas</span>
                  <button
                    type="button"
                    disabled={coins < 10}
                    onClick={onBuyTreat}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Dar Petisco
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'garden' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['carrot', 'tomato', 'sunflower'] as const).map((seedKey) => {
                const info = SEED_CATALOG[seedKey];
                const canAfford = coins >= info.price;
                return (
                  <div
                    key={seedKey}
                    className="bg-white border border-[#E5DDD0] rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-lime-50 text-lime-700 flex items-center justify-center shrink-0">
                        <Sprout className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-[#2B2520]">
                          {info.name}
                        </h3>
                        <p className="text-xs text-[#6C6054] mt-1 leading-relaxed">
                          {info.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#F0E9DE]">
                      <span className="text-xs font-bold text-amber-800 tabular-nums">
                        {info.price} moedas
                      </span>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuySeed(seedKey)}
                        className="px-3.5 py-1.5 rounded-xl bg-lime-700 text-white text-xs font-semibold hover:bg-lime-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        Comprar e Plantar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
