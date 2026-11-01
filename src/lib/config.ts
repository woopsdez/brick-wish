export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
export const hasPush = hasSupabase && Boolean(VAPID_PUBLIC_KEY)

export const BRICKLINK_WANTED_UPLOAD_URL = 'https://www.bricklink.com/v2/wanted/upload.page'
export const BRICKLINK_WANTED_LIST_URL = 'https://www.bricklink.com/v2/wanted/list.page'
