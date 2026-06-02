import { createClient } from '@/lib/supabase/client'

export async function uploadListingImage(
  file: File,
  userId: string
): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Nur JPEG, PNG oder WebP erlaubt')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Max. 5 MB pro Bild')
  }

  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('listings')
    .upload(path, file, { upsert: false, contentType: file.type })

  if (error) throw new Error('Upload fehlgeschlagen: ' + error.message)

  return supabase.storage.from('listings').getPublicUrl(path).data.publicUrl
}
