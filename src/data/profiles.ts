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
  {
    id: 'aline-sousa',
    name: 'Aline Sousa',
    title: 'Chef Executiva',
    description:
      'Chef especializada em culinária futurista e consultora do cardápio neon, suas receitas ditam a cadência do Zord.',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop',
    keywords: ['aline', 'chef', 'executiva', 'culinária', 'cozinha'],
  },
  {
    id: 'lucas-varela',
    name: 'Lucas Varela',
    title: 'Analista de Experiência',
    description:
      'Especialista em UI/UX que monitora como o público interage com a interface, garantindo fidelidade e respostas naturais.',
    photo: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?q=80&w=800&auto=format&fit=crop',
    keywords: ['lucas', 'varela', 'analista', 'experiência', 'ux'],
  },
]
