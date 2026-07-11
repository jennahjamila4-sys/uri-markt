'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'

/**
 * Real-time notifications listener
 * Loads initial notifications and subscribes to new ones
 */
export function useNotifications(userId: string | undefined) {
  const setNotifications = useAppStore((s) => s.setNotifications)
  const addNotification = useAppStore((s) => s.addNotification)

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    // Load initial unread notifications (Spalten gemäss echtem Schema:
    // recipient_id / is_read / title / message / listing_id – kein payload)
    supabase
      .from('notifications')
      .select('id,type,title,message,listing_id,is_read,created_at,recipient_id')
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setNotifications(data)
      })

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as {
            id: string
            recipient_id: string | null
            type: string | null
            title: string | null
            message: string | null
            listing_id: string | null
            is_read: boolean | null
            created_at: string | null
          }
          addNotification(newNotif)

          // Live-Toast mit Titel/Message direkt aus den Spalten
          if (newNotif.title) {
            toast(newNotif.title, { description: newNotif.message ?? undefined })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, setNotifications, addNotification])
}
