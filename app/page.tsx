'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  useEffect(() => { router.push('/admin') }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#0a1628'}}>
      <div className="text-white text-xl">Se încarcă...</div>
    </div>
  )
}
