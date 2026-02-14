import { NextResponse } from 'next/server'
import { PROFILES } from '@/data/profiles'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const name = (searchParams.get('name') || '').trim().toLowerCase()

    if (!name) {
      return NextResponse.json({ error: 'Informe quem você gostaria de ver.' }, { status: 400 })
    }

    const scoreMatch = PROFILES.find(profile =>
      profile.name.toLowerCase().includes(name) ||
      profile.keywords.some(keyword => name.includes(keyword)) ||
      profile.keywords.some(keyword => keyword.includes(name)),
    )

    if (!scoreMatch) {
      return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ profile: scoreMatch })
  } catch (error) {
    console.error('Erro ao buscar perfil:', error)
    return NextResponse.json({ error: 'Erro interno ao buscar o perfil.' }, { status: 500 })
  }
}
