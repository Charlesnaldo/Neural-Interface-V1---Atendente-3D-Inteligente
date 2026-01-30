'use client'

import React from 'react'

export interface MenuItem {
    id: string
    name: string
    price: number
    description: string
    image: string
    tag: string
}

const MENU_DATA: MenuItem[] = [
    {
        id: '1',
        name: 'Zord Ultimate Burger',
        price: 42.90,
        description: 'Blend de Wagyu 180g, queijo monterey jack maçaricado, cebola caramelizada no bourbon.',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop',
        tag: 'BEST SELLER'
    },
    {
        id: '2',
        name: 'Fritas Trufadas Neon',
        price: 24.00,
        description: 'Batatas rústicas duplamente fritas com azeite de trufas brancas e parmesão.',
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=800&auto=format&fit=crop',
        tag: 'SIDE DISH'
    },
    {
        id: '3',
        name: 'Supernova Shake',
        price: 28.00,
        description: 'Gelato de baunilha, calda explosiva de frutas vermelhas e cristais neon.',
        image: 'https://images.unsplash.com/photo-1579954115545-a95591f28be0?q=80&w=800&auto=format&fit=crop',
        tag: 'DESSERT'
    },
]

interface MenuDisplayProps {
    onAddToCart: (item: MenuItem) => void
    onClose: () => void
    lastAddedId?: string | null
}

export function MenuDisplay({ onAddToCart, onClose, lastAddedId }: MenuDisplayProps) {
    return (
        <div className="absolute top-10 inset-x-0 z-40 flex flex-col items-center p-8 animate-in slide-in-from-top-10 fade-in duration-700">
            {/* Botão de Fechar Estilizado */}
            <button
                onClick={onClose}
                className="absolute top-4 right-8 z-50 p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white hover:bg-red-500/80 hover:border-red-500 transition-all duration-300 group shadow-lg"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            <div className="w-full max-w-6xl pointer-events-none">
                <div className="flex flex-col items-center mb-8">
                    <h2 className="text-white text-3xl font-black tracking-tighter mb-1 italic drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">CARDÁPIO <span className="text-orange-500">DIGITAL</span></h2>
                    <div className="h-0.5 w-20 bg-orange-600 rounded-full" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pointer-events-auto">
                    {MENU_DATA.map((item, index) => {
                        const isSelected = item.id === lastAddedId;
                        return (
                            <div key={item.id} className={`group relative bg-neutral-900/40 border ${isSelected ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-white/10'} rounded-3xl overflow-hidden hover:border-orange-500/50 transition-all duration-500 hover:-translate-y-2`}>
                                <div className="h-48 overflow-hidden relative">
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    {/* Badge de Tag */}
                                    <div className="absolute top-4 left-4 z-10">
                                        <span className="px-3 py-1 bg-orange-500 text-black text-[8px] font-black rounded-full uppercase tracking-widest shadow-lg">
                                            {item.tag}
                                        </span>
                                    </div>
                                    {/* Número da Opção / Atalho Mental */}
                                    <div className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                        <span className="text-white font-black text-sm">{index + 1}</span>
                                    </div>

                                    {/* Overlay de Sucesso ao Adicionar */}
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-green-500/20 backdrop-blur-[2px] z-20 flex items-center justify-center animate-in zoom-in duration-300">
                                            <div className="bg-green-500 text-white rounded-full p-2 shadow-2xl">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6">
                                    <h3 className="text-white font-bold text-xl mb-2 group-hover:text-orange-400 transition-colors">{item.name}</h3>
                                    <p className="text-white/40 text-[11px] leading-relaxed mb-6 h-12 line-clamp-2">
                                        {item.description}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-white/20 text-[8px] font-bold uppercase tracking-widest">Preço Individual</span>
                                            <span className="text-white font-mono text-2xl font-black">R$ {item.price.toFixed(2)}</span>
                                        </div>
                                        <button
                                            onClick={() => onAddToCart(item)}
                                            className={`p-3 rounded-xl transition-all active:scale-90 ${isSelected ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-orange-500 hover:text-white'}`}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M12 5v14M5 12h14" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    )
}

export { MENU_DATA }
