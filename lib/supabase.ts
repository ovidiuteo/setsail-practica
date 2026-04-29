import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Location = { id: string; name: string; county: string }
export type Boat = { id: string; name: string; registration: string }
export type Evaluator = { id: string; full_name: string; title: string; decision_number: string }
export type Instructor = { id: string; full_name: string; email: string }
export type Session = {
  id: string
  session_date: string
  location_id: string
  boat_id: string
  evaluator_id: string
  instructor_id: string
  class_caa: string
  access_code: string
  status: string
  notes: string
  locations?: Location
  boats?: Boat
  evaluators?: Evaluator
  instructors?: Instructor
}
export type Student = {
  id: string
  session_id: string
  full_name: string
  cnp: string
  id_document: string
  email: string
  class_caa: string
  portal_status: string
  signed_at: string
  signature_data: string
  order_in_session: number
}
