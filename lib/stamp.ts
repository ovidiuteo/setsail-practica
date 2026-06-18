import sharp from 'sharp'

// Normalizează o ștampilă (sigiliu colorat pe fundal alb) → fundal transparent,
// păstrând culoarea sigiliului și anti-aliasing-ul.
// alfa = cât de departe e pixelul de alb (alb → transparent, culoare → opac).
export async function stampToTransparentDataUrl(dataUrlOrBase64: string): Promise<string | null> {
  try {
    const b64 = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.split(',')[1] : dataUrlOrBase64
    const raw = Buffer.from(b64, 'base64')
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const ch = info.channels // 4 (RGBA)
    for (let i = 0; i < data.length; i += ch) {
      const minC = Math.min(data[i], data[i + 1], data[i + 2])
      // pixel aproape alb → complet transparent; restul → opac proporțional cu distanța de alb
      data[i + 3] = minC > 240 ? 0 : 255 - minC
    }
    const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer()
    return `data:image/png;base64,${out.toString('base64')}`
  } catch {
    return null
  }
}
