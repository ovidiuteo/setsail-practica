import sharp from 'sharp'

// Recolorează o semnătură (PNG, strokes închise pe fundal alb sau transparent)
// în albastru „de pix", păstrând anti-aliasing-ul, pe fundal transparent.
// Robust: foloseste luminozitatea ca masca de alfa (intunecat -> opac albastru).
const PEN_BLUE = { r: 22, g: 53, b: 158 }

export async function tintSignatureToBlue(dataUrlOrBase64: string): Promise<Buffer | null> {
  try {
    const b64 = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.split(',')[1] : dataUrlOrBase64
    const raw = Buffer.from(b64, 'base64')
    const meta = await sharp(raw).metadata()
    const w = meta.width, h = meta.height
    if (!w || !h) return null
    // alfa = inversul luminozitatii peste fundal alb (strokes inchise -> opac)
    const alpha = await sharp(raw).flatten({ background: '#ffffff' }).greyscale().negate().raw().toBuffer()
    return await sharp({ create: { width: w, height: h, channels: 3, background: PEN_BLUE } })
      .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
      .png().toBuffer()
  } catch {
    return null
  }
}

export async function tintSignatureToBlueDataUrl(dataUrlOrBase64: string): Promise<string | null> {
  const buf = await tintSignatureToBlue(dataUrlOrBase64)
  return buf ? `data:image/png;base64,${buf.toString('base64')}` : null
}
