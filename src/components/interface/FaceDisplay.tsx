'use client'

import React, { Suspense } from 'react'

interface FaceDisplayProps {
    isSpeaking: boolean;
    children: React.ReactNode;
}

export const FaceDisplay = ({ isSpeaking, children }: FaceDisplayProps) => {
    return (
        <div className="relative w-full max-w-[500px] aspect-square z-10">
            <div className={`absolute inset-0 bg-cyan-500/5 rounded-full blur-[120px] transition-opacity duration-1000 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative w-full h-full rounded-full border border-white/[0.03] bg-neutral-950/20 backdrop-blur-md overflow-hidden shadow-2xl">
                <Suspense fallback={null}>
                    {children}
                </Suspense>
            </div>
        </div>
    );
};
