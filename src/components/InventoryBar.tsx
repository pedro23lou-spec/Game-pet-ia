import React from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Coins,
  Crosshair,
  Move,
  ShoppingBag,
  Sprout,
  Trash2,
  X,
} from 'lucide-react';
import type { FurnitureType, PlacedFurniture, SeedType } from '../types/game';
import { FURNITURE_CATALOG, SEED_CATALOG } from '../world/mapData';

interface InventoryBarProps {
  coins: number;
  placingType: FurnitureType | null;
  movingFurnitureId: string | null;
  activeSeedToPlant: SeedType | null;
  onCancelPlacementOrSeed: () => void;
  selectedFurniture: PlacedFurniture | null;
  onStartMoveFurniture: (id: string) => void;
  onFeedFromFridge: (id: string) => void;
  onRefillFridgePaid: (id: string) => void;
  onOpenDiary: (id: string) => void;
  onOpenPenaltyGame: () => void;
  onRemoveFurniture: (id: string) => void;
  onClearSelection: () => void;
  onOpenShop: () => void;
  onOpenWorkGate: () => void;
  cameraFollowsPet: boolean;
  onCenterOnPet: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const InventoryBar: React.FC<InventoryBarProps> = ({
  coins,
  placingType,
  movingFurnitureId,
  activeSeedToPlant,
  onCancelPlacementOrSeed,
  selectedFurniture,
  onStartMoveFurniture,
  onFeedFromFridge,
  onRefillFridgePaid,
  onOpenDiary,
  onOpenPenaltyGame,
  onRemoveFurniture,
  onClearSelection,
  onOpenShop,
  onOpenWorkGate,
  cameraFollowsPet,
  onCenterOnPet,
  isCollapsed,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    return (
      <div className="pointer-events-none fixed bottom-2.5 left-2.5 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expandir barra inferior"
          title="Mostrar loja e ações"
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F2]/88 backdrop-blur-md border border-[#DFD5C5] text-[#2B2520] text-xs font-semibold shadow-md hover:bg-[#FAF7F2] transition-colors cursor-pointer whitespace-nowrap"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          <span>Menu</span>
        </button>

        {!cameraFollowsPet && (
          <button
            type="button"
            onClick={onCenterOnPet}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2B2520]/90 text-[#FAF7F2] text-xs font-semibold shadow-md cursor-pointer whitespace-nowrap"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Centralizar</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-0 inset-x-0 z-20 p-2 sm:p-4 flex flex-col items-center gap-2">
      {/* Placement / Move / Plant Hint */}
      {(placingType || movingFurnitureId || activeSeedToPlant) && (
        <div className="pointer-events-auto max-w-[calc(100vw-16px)] flex items-center gap-2.5 bg-[#2B2520]/95 text-[#FAF7F2] px-3.5 py-2 rounded-xl text-xs font-medium shadow-md">
          <span className="truncate">
            {activeSeedToPlant ? (
              <>
                Plantando <strong>{SEED_CATALOG[activeSeedToPlant].name}</strong> — clique em um
                canteiro no quintal
              </>
            ) : movingFurnitureId ? (
              <>Clique no chão para reposicionar o móvel</>
            ) : placingType ? (
              <>
                Posicionando <strong>{FURNITURE_CATALOG[placingType].name}</strong> — clique no
                chão
              </>
            ) : null}
          </span>
          <button
            type="button"
            onClick={onCancelPlacementOrSeed}
            className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Cancelar
          </button>
        </div>
      )}

      {/* Selected Furniture Quick Actions */}
      {!placingType && !movingFurnitureId && !activeSeedToPlant && selectedFurniture && (
        <div className="pointer-events-auto max-w-[calc(100vw-16px)] flex flex-wrap items-center justify-center gap-2 bg-[#FAF7F2]/95 backdrop-blur-md border border-[#DFD5C5] text-[#2B2520] px-3.5 py-2 rounded-xl text-xs font-medium shadow-md">
          <span className="font-semibold">
            {FURNITURE_CATALOG[selectedFurniture.type].name}
          </span>

          {selectedFurniture.type === 'fridge' && (
            <>
              <span aria-hidden="true" className="text-[#9E9080]">
                ·
              </span>
              <span className="tabular-nums text-[#5C5044]">
                Comida: {selectedFurniture.foodStock}/{selectedFurniture.maxFoodStock}
              </span>
              <button
                type="button"
                disabled={selectedFurniture.foodStock <= 0}
                onClick={() => onFeedFromFridge(selectedFurniture.id)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                Alimentar
              </button>
              <button
                type="button"
                disabled={coins < 15 || selectedFurniture.foodStock >= selectedFurniture.maxFoodStock}
                onClick={() => onRefillFridgePaid(selectedFurniture.id)}
                className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap tabular-nums"
              >
                Reabastecer (15 moedas)
              </button>
            </>
          )}

          {selectedFurniture.type === 'diary' && (
            <button
              type="button"
              onClick={() => onOpenDiary(selectedFurniture.id)}
              className="px-2.5 py-1 rounded-lg bg-[#7C2D49] text-white hover:bg-[#64223A] transition-colors cursor-pointer whitespace-nowrap"
            >
              Abrir Diário
            </button>
          )}

          {selectedFurniture.type === 'ball' && (
            <button
              type="button"
              onClick={onOpenPenaltyGame}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lime-700 text-white hover:bg-lime-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CircleDot className="w-3.5 h-3.5" />
              Jogar Pênaltis Juntos
            </button>
          )}

          <button
            type="button"
            onClick={() => onStartMoveFurniture(selectedFurniture.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFE8DC] text-[#2B2520] hover:bg-[#E2D8C8] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Move className="w-3.5 h-3.5" />
            Reposicionar
          </button>

          <button
            type="button"
            onClick={() => onRemoveFurniture(selectedFurniture.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Fechar seleção"
            className="p-1 text-[#7A6E61] hover:text-[#2B2520] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Bottom Dock */}
      <div className="pointer-events-auto max-w-[calc(100vw-16px)] bg-[#FAF7F2]/94 backdrop-blur-md border border-[#DFD5C5] shadow-[0_8px_28px_rgba(32,24,16,0.16)] rounded-2xl p-1.5 sm:p-2 flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={onOpenShop}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
        >
          <ShoppingBag className="w-4 h-4 shrink-0" />
          <span>Loja</span>
          <span className="inline-flex items-center gap-0.5 text-amber-100 tabular-nums">
            · <Coins className="w-3 h-3" />
            {coins}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenWorkGate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F3ECE1] text-[#2B2520] hover:bg-[#E7DEC9] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Briefcase className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Trabalho</span>
        </button>

        <button
          type="button"
          onClick={onOpenShop}
          title="Horta no quintal (compre sementes na Loja)"
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F3ECE1] text-[#2B2520] hover:bg-[#E7DEC9] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Sprout className="w-4 h-4 text-lime-700 shrink-0" />
          <span>Horta</span>
        </button>

        <button
          type="button"
          onClick={onCenterOnPet}
          title="Seguir o pet com a câmera"
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
            !cameraFollowsPet
              ? 'bg-[#2B2520] text-[#FAF7F2] border-[#2B2520] hover:bg-[#3E362F]'
              : 'bg-transparent text-[#5C5044] border-[#DFD5C5] hover:bg-[#EFE8DC] hover:text-[#2B2520]'
          }`}
        >
          <Crosshair className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Focar</span>
          <span className="hidden sm:inline">Centralizar no Pet</span>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Minimizar barra inferior"
          title="Minimizar barra inferior"
          className="p-2 rounded-xl border border-[#DFD5C5] bg-transparent text-[#5C5044] hover:bg-[#EFE8DC] hover:text-[#2B2520] transition-colors cursor-pointer shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
