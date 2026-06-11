'use client'
import { useParams } from 'next/navigation'
import DiplomaForm from '../DiplomaForm'

export default function DiplomaEditPage() {
  const params = useParams<{ id: string }>()
  return <DiplomaForm diplomaId={params.id} />
}
