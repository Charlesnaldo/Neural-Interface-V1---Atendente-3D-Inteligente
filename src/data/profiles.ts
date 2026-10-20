'use client'
export interface Profile {
  id: string
  name: string
  title: string
  description: string
  photo: string
  keywords: string[]
}

export const PROFILES: Profile[] = [
  {
    id: 'ronaldo-charles',
    name: 'Ronaldo Charles',
    title: 'Criador do Zord',
    description:
      'Engenheiro de IA e designer de experiências imersivas, responsável por toda a arquitetura neural do atendente.',
    photo: '/perfil.jpg',
    keywords: ['ronaldo', 'charles', 'criador', 'desenvolvedor', 'engenheiro'],
  },
]
