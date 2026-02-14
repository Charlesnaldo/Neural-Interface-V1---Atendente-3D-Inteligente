'use client'
import React, { useEffect } from 'react'
import { Profile } from '@/data/profiles'

interface ProfileCardProps {
  profile: Profile
  onClose: () => void
}

export const ProfileCard = ({ profile, onClose }: ProfileCardProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 7500)
    return () => clearTimeout(timer)
  }, [profile.id, onClose])

  return (
    <div className="absolute top-24 left-6 z-50 animate-in slide-in-from-left-20 fade-in duration-700">
      <div className="relative group [transform:rotateY(8deg)] transition-all duration-700">
        <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/40 to-red-500/20 rounded-3xl blur-3xl opacity-60 group-hover:opacity-100" />
        <div className="relative bg-neutral-900/90 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[25px_25px_60px_rgba(0,0,0,0.75)] flex flex-col gap-4 p-5 w-64">
          <div className="relative w-full h-48 overflow-hidden rounded-2xl border border-white/10">
            <img
              src={profile.photo}
              alt={profile.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
          <div>
            <h3 className="text-white font-black text-xl tracking-tight">{profile.name}</h3>
            <p className="text-white/50 text-xs uppercase tracking-[0.4em] mb-2">{profile.title}</p>
            <p className="text-white/70 text-[11px] leading-relaxed">{profile.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-[10px] font-bold tracking-[0.5em] uppercase transition-colors"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  )
}
