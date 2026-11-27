import React, { useState, useEffect } from 'react';
import { Download, Globe, Palette, Trash2, X } from 'lucide-react';
import type { ArtworkEntry, DiscoveryEntry, TraitKey } from '../types/game';
import { SafeSvgArt } from './SafeSvgArt';

interface ArtGalleryModalProps {
  isOpen: boolean;
  initialTab?: 'art' | 'discoveries';
  onClose: () => void;
  artworks: ArtworkEntry[];
  discoveries: DiscoveryEntry[];
  petName: string;
  onDeleteArtwork: (id: string) => void;
  onDeleteDiscovery: (id: string) => void;
}

const TIME_LABELS: Record<ArtworkEntry['timeOfDay'], string> = {
  day: 'Dia',
  dusk: 'Entardecer',
  night: 'Noite',
};

const TRAIT_LABELS: Record<TraitKey, string> = {
  curioso: 'Curioso',
  nerd: 'Nerd',
  filosofo: 'Filósofo',
  artistico: 'Artístico',
  carinhoso: 'Carinhoso',
  trabalhador: 'Trabalhador',
  preguicoso: 'Preguiçoso',
};

function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export const ArtGalleryModal: React.FC<ArtGalleryModalProps> = ({
  isOpen,
  initialTab = 'art',
  onClose,
  artworks,
  discoveries,
  petName,
  onDeleteArtwork,
  onDeleteDiscovery,
}) => {
  const [activeTab, setActiveTab] = useState<'art' | 'discoveries'>(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && artworks.length > 0) {
      setSelectedId((prev) =>
        prev && artworks.some((a) => a.id === prev) ? prev : artworks[0].id
      );
    } else if (!isOpen) {
      setSelectedId(null);
    }
  }, [isOpen, artworks]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeArtwork = artworks.find((a) => a.id === selectedId) ?? artworks[0] ?? null;

  const handleDownloadSvg = (art: ArtworkEntry) => {
    const blob = new Blob([art.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${art.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[#1B1612]/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Galeria e Descobertas de ${petName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header + Segmented Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[#E5DDD0] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-lg sm:text-xl text-[#2B2520]">
                Caderno de {petName}
              </h2>
              <p className="text-xs text-[#6C6054] mt-0.5 tabular-nums">
                {artworks.length} artes · {discoveries.length} descobertas
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar galeria"
              className="sm:hidden p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#EFE8DC] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#EFE8DC] rounded-xl border border-[#DFD5C5]">
              <button
                type="button"
                onClick={() => setActiveTab('art')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'art'
                    ? 'bg-white text-[#2B2520] shadow-xs'
                    : 'text-[#6C6054] hover:text-[#2B2520]'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Arte ({artworks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('discoveries')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'discoveries'
                    ? 'bg-white text-[#2B2520] shadow-xs'
                    : 'text-[#6C6054] hover:text-[#2B2520]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Descobertas ({discoveries.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar galeria"
              className="hidden sm:inline-flex p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#EFE8DC] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Artworks */}
        {activeTab === 'art' && (
          <>
            {artworks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 sm:p-10 gap-3 overflow-y-auto">
                <div className="w-14 h-14 rounded-2xl bg-[#EFE8DC] flex items-center justify-center text-amber-700">
                  <Palette className="w-7 h-7" />
                </div>
                <h3 className="font-display font-semibold text-lg text-[#2B2520]">
                  O ateliê ainda está vazio
                </h3>
                <p className="text-sm text-[#6C6054] max-w-md leading-relaxed">
                  Coloque um <strong>Cavalete de Pintura</strong> no mapa e deixe {petName} explorar
                  sozinho. Quando ficar inspirado, ele pintará um quadro inédito!
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
                {/* Featured artwork showcase - full uncropped SVG on mobile */}
                {activeArtwork && (
                  <div className="md:col-span-7 p-5 sm:p-6 flex flex-col items-center md:justify-center bg-[#F3ECE1]/60 border-b md:border-b-0 md:border-r border-[#E5DDD0] md:overflow-y-auto">
                    <div className="w-48 h-48 sm:w-64 sm:h-64 mx-auto shrink-0 bg-white p-2.5 sm:p-3 rounded-2xl border-4 border-[#D6C3A5] shadow-md overflow-hidden">
                      <SafeSvgArt svgMarkup={activeArtwork.svg} altTitle={activeArtwork.title} />
                    </div>

                    <div className="mt-4 sm:mt-5 text-center max-w-md">
                      <h3 className="font-display font-bold text-lg sm:text-xl text-[#2B2520] text-balance">
                        {activeArtwork.title}
                      </h3>
                      <p className="mt-2 text-sm text-[#4A4036] italic leading-relaxed">
                        “{activeArtwork.explanation}”
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#7A6E61] flex-wrap">
                        <span>Humor: {activeArtwork.mood}</span>
                        <span aria-hidden="true">·</span>
                        <span>{TIME_LABELS[activeArtwork.timeOfDay]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatDateTime(activeArtwork.createdAt)}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadSvg(activeArtwork)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2B2520] text-[#FAF7F2] text-xs font-semibold hover:bg-[#3E352D] transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Baixar SVG
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteArtwork(activeArtwork.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thumbnail grid */}
                <div className="md:col-span-5 p-4 md:overflow-y-auto grid grid-cols-2 gap-3 content-start">
                  {artworks.map((art) => {
                    const isCurrent = activeArtwork?.id === art.id;
                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => setSelectedId(art.id)}
                        className={`group text-left rounded-2xl p-2.5 transition-all cursor-pointer border ${
                          isCurrent
                            ? 'bg-white border-amber-600 shadow-sm'
                            : 'bg-[#F5EFE6] border-[#E5DDD0] hover:bg-white'
                        }`}
                      >
                        <div className="w-full aspect-square rounded-xl overflow-hidden bg-white border border-[#E5DDD0]">
                          <SafeSvgArt svgMarkup={art.svg} altTitle={art.title} />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-[#2B2520] truncate">
                          {art.title}
                        </p>
                        <p className="text-[11px] text-[#7A6E61] truncate tabular-nums">
                          {formatDateTime(art.createdAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Internet Discoveries */}
        {activeTab === 'discoveries' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {discoveries.length === 0 ? (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#EFE8DC] flex items-center justify-center text-sky-700">
                  <Globe className="w-7 h-7" />
                </div>
                <h3 className="font-display font-semibold text-lg text-[#2B2520]">
                  Nenhuma descoberta ainda
                </h3>
                <p className="text-sm text-[#6C6054] max-w-md leading-relaxed">
                  Coloque um <strong>Computador</strong> na casa. Quando {petName} ficar curioso,
                  ele vai navegar sozinho e salvar fatos incríveis aqui!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {discoveries.map((disc) => (
                  <article
                    key={disc.id}
                    className="bg-white border border-[#E5DDD0] rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-base text-[#2B2520] leading-snug">
                          {disc.topic}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onDeleteDiscovery(disc.id)}
                          aria-label="Excluir descoberta"
                          className="p-1.5 rounded-lg text-[#8A7D6F] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-[#4A4036] leading-relaxed">
                        {disc.learned}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#F0E9DE] flex items-center gap-2 text-xs text-[#7A6E61] flex-wrap">
                      <span className="font-semibold text-sky-800">
                        +{disc.traitDelta} {TRAIT_LABELS[disc.traitKey]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Humor: {disc.mood}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDateTime(disc.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
