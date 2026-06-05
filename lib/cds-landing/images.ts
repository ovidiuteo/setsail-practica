// ============================================================================
// CDS Landing — server-side image optimization (sharp → webp + resize per slot)
// ============================================================================
import 'server-only'
import sharp from 'sharp'

type Dim = { w: number; h?: number; fit: 'inside' | 'cover'; q?: number }

// Target dimensions match the recommended sizes shown in the editor.
function dimsFor(slot: string): Dim {
  if (slot.startsWith('hero')) return { w: 2400, h: 1600, fit: 'inside' }
  if (slot.startsWith('final')) return { w: 2000, h: 1200, fit: 'inside' }
  if (slot.startsWith('benefits')) return { w: 900, h: 600, fit: 'inside' }
  if (slot.startsWith('value')) return { w: 400, h: 400, fit: 'cover' }
  if (slot.startsWith('testimonial')) return { w: 160, h: 160, fit: 'cover' }
  return { w: 1600, fit: 'inside' }
}

export async function optimizeToWebp(input: Buffer, slot: string): Promise<Buffer> {
  const d = dimsFor(slot)
  return sharp(input)
    .rotate() // honor EXIF orientation
    .resize(d.w, d.h, { fit: d.fit, withoutEnlargement: true })
    .webp({ quality: d.q ?? 80 })
    .toBuffer()
}
