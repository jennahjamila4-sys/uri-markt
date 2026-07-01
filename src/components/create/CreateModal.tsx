'use client'
import { useAppStore } from '@/store/appStore'
import { AngebotForm } from './AngebotForm'
import { GesuchForm } from './GesuchForm'
import { X } from 'lucide-react'

export function CreateModal() {
  const isOpen = useAppStore((s) => s.isCreateModalOpen)
  const setIsOpen = useAppStore((s) => s.setCreateModalOpen)
  const createModalTab = useAppStore((s) => s.createModalTab)
  const setCreateModalTab = useAppStore((s) => s.setCreateModalTab)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative max-h-[90dvh] w-full animate-slide-up overflow-y-auto rounded-t-3xl border border-glass-border bg-obsidian-3 p-6 shadow-modal">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-white/60 hover:text-white"
        >
          <X size={24} />
        </button>

        <div className="mb-6 flex gap-4 border-b border-glass-border pb-4">
          <button
            onClick={() => setCreateModalTab('Angebot')}
            className={`flex items-center gap-2 font-display font-bold ${
              createModalTab === 'Angebot' ? 'text-gold' : 'text-white/60'
            }`}
          >
            <span>🏷️</span>
            <span>Angebot</span>
          </button>
          <button
            onClick={() => setCreateModalTab('Gesuch')}
            className={`flex items-center gap-2 font-display font-bold ${
              createModalTab === 'Gesuch' ? 'text-gold' : 'text-white/60'
            }`}
          >
            <span>🔍</span>
            <span>Gesuch</span>
          </button>
          <button
            onClick={() => setCreateModalTab('Event')}
            className="flex items-center gap-2 font-display font-bold text-white/60 opacity-50 cursor-not-allowed"
          >
            <span>🚀</span>
            <span>Event</span>
            <span className="text-xs bg-gold text-obsidian px-2 py-0.5 rounded-full">Phase 2</span>
          </button>
        </div>

        {createModalTab === 'Angebot' && (
          <AngebotForm onSuccess={() => setIsOpen(false)} />
        )}
        {createModalTab === 'Gesuch' && (
          <GesuchForm onSuccess={() => setIsOpen(false)} />
        )}
      </div>
    </div>
  )
}
