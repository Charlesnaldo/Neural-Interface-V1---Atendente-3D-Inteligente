'use client'

import React from 'react'
import { MenuItem } from './MenuDisplay'

interface CartListProps {
    items: MenuItem[]
    onRemove: (index: number) => void
}

export function CartList({ items, onRemove }: CartListProps) {
    const total = items.reduce((acc, item) => acc + item.price, 0)

    return (
        <div className="absolute bottom-40 right-12 z-40 w-80 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="bg-neutral-900/80 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h4 className="text-[10px] text-orange-400 font-mono uppercase tracking-[0.2em] font-bold">Resumo do Pedido</h4>
                    <span className="text-[9px] text-white/40 font-mono uppercase">{items.length} itens</span>
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {items.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="px-5 py-3 flex justify-between items-center border-b border-white/5 hover:bg-white/5 transition-colors group">
                            <div className="flex flex-col">
                                <span className="text-white text-xs font-medium">{item.name}</span>
                                <span className="text-white/40 text-[9px] font-mono">R$ {item.price.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={() => onRemove(idx)}
                                className="text-white/20 hover:text-red-500 transition-colors p-1"
                                title="Remover item"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-5 bg-orange-500/10">
                    <div className="flex justify-between items-center">
                        <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Total</span>
                        <span className="text-orange-400 font-mono text-lg font-black">R$ {total.toFixed(2)}</span>
                    </div>
                    <button className="w-full mt-4 bg-orange-500 hover:bg-orange-400 text-white text-[9px] font-bold py-2 rounded-md uppercase tracking-[0.2em] transition-all shadow-lg shadow-orange-500/20 active:scale-95">
                        Finalizar Pedido
                    </button>
                </div>
            </div>
        </div>
    )
}
