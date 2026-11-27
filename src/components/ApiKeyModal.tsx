import React, { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Trash2, X } from 'lucide-react';
import {
  clearUserApiKey,
  getStoredUserApiKey,
  saveUserApiKey,
} from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  canClose: boolean;
  hasServerKey: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCleared?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  canClose,
  hasServerKey,
  onClose,
  onSaved,
  onCleared,
}) => {
  const [draftKey, setDraftKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredUserApiKey();
      setDraftKey(stored);
      setHasSavedKey(Boolean(stored));
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftKey.trim();
    if (!cleaned) {
      setErrorMsg('Cole uma chave válida do Google AI Studio antes de continuar.');
      return;
    }
    saveUserApiKey(cleaned);
    setHasSavedKey(true);
    setErrorMsg(null);
    onSaved();
  };

  const handleClear = () => {
    clearUserApiKey();
    setDraftKey('');
    setHasSavedKey(false);
    setErrorMsg(null);
    if (hasServerKey) {
      onSaved();
    } else {
      onCleared?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B1612]/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Conecte o Cérebro do seu Companheiro"
    >
      <div className="w-full max-w-md bg-[#FAF7F2] border border-[#DFD5C5] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E5DDD0] bg-[#F5EFE6] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="font-display font-bold text-base sm:text-lg text-[#2B2520]">
              Conecte o Cérebro do seu Companheiro
            </h2>
          </div>

          {canClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar configurações de chave"
              className="p-2 rounded-xl text-[#6C6054] hover:text-[#2B2520] hover:bg-[#E5DDD0]/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-[#4A4036] leading-relaxed">
            Para o seu pet pensar, desenhar e pesquisar na internet de graça usando a sua própria
            cota diária do Google, cole sua chave gratuita do Google AI Studio.
          </p>

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2"
          >
            <span>Pegar chave gratuita em aistudio.google.com/apikey</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>

          <div>
            <label
              htmlFor="user-gemini-api-key"
              className="block text-xs font-semibold text-[#2B2520] mb-1.5"
            >
              Sua API Key do Google AI Studio
            </label>
            <input
              id="user-gemini-api-key"
              type="password"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="Cole sua chave aqui (AIza...)"
              autoComplete="off"
              className="w-full bg-white border border-[#DFD5C5] rounded-xl px-3.5 py-2.5 text-sm text-[#2B2520] focus:outline-none focus:border-amber-600"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {errorMsg}
            </p>
          )}

          {hasServerKey && !hasSavedKey && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              O ambiente do AI Studio já fornece uma chave padrão. Você só precisa preencher abaixo
              se quiser usar uma chave própria.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {hasSavedKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Chave</span>
              </button>
            ) : (
              <span className="text-[11px] text-[#7A6E61]">
                Salva apenas no seu navegador.
              </span>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#2B2520] text-[#FAF7F2] text-xs font-semibold hover:bg-[#3D352E] transition-colors cursor-pointer ml-auto"
            >
              Salvar e Começar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
