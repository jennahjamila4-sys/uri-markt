'use client'
import { CATEGORIES } from '@/types'

interface CategoryFilterProps {
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
}

export function CategoryFilter({
  selectedCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
      <button
        onClick={() => onCategoryChange(null)}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-body transition ${
          selectedCategory === null
            ? 'bg-gold text-obsidian font-bold'
            : 'glass-card glass-card-hover text-white/60'
        }`}
      >
        Alle
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-body transition flex items-center gap-1 ${
            selectedCategory === cat.id
              ? 'bg-gold text-obsidian font-bold'
              : 'glass-card glass-card-hover text-white/60'
          }`}
        >
          <span>{cat.emoji}</span>
          <span className="hidden sm:inline">{cat.label}</span>
        </button>
      ))}
    </div>
  )
}
