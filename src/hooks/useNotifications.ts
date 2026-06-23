'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'

/**
 * Real-time notifications listener
 * Loads initial notifications and subscribes to new ones
 */
export function useNotifications(userId: string | undefined) {
  const supabase = createClient()
  const setNotifications = useAppStore((s) => s.setNotifications)
  const addNotification = useAppStore((s) => s.addNotification)

  useEffect(() => {
    if (!userId) return

    // Load initial unread notifications
    supabase
      .from('notifications')
      .select('id,type,payload,read,created_at,user_id')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          const notifications = data.map((n) => ({
            id: n.id,
            user_id: n.user_id,
            type: n.type,
            payload: n.payload,
            read: n.read,
            created_at: n.created_at,
          }))
          setNotifications(notifications)
        }
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
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new
          addNotification({
            id: newNotif.id,
            user_id: newNotif.user_id,
            type: newNotif.type,
            payload: newNotif.payload,
            read: newNotif.read,
            created_at: newNotif.created_at,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, setNotifications, addNotification])
}
