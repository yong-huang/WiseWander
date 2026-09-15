import { create } from 'zustand'
import type { Recommendation, InterestProfile, ReadingListItem, RecommendationBundle } from '../../shared/types'

type RecommendationStatus = 'idle' | 'loading' | 'refreshing' | 'done' | 'error'

interface RecommendationState {
  recommendations: Recommendation[]
  interestProfiles: InterestProfile[]
  recommendationStatus: RecommendationStatus
  readingList: ReadingListItem[]
  readingListTotal: number

  loadRecommendations: () => Promise<void>
  refreshRecommendations: () => Promise<void>
  setupStreamListener: () => () => void
  addToReadingList: (params: { url: string; title: string; excerpt?: string; faviconUrl?: string }) => Promise<void>
  removeFromReadingList: (id: number) => Promise<void>
  loadReadingList: (page?: number, perPage?: number) => Promise<void>
}

export const useRecommendationStore = create<RecommendationState>((set) => ({
  recommendations: [],
  interestProfiles: [],
  recommendationStatus: 'idle',
  readingList: [],
  readingListTotal: 0,

  loadRecommendations: async () => {
    set({ recommendationStatus: 'loading' })
    try {
      const bundle = (await window.api.recommendationGet()) as RecommendationBundle
      set({
        recommendations: bundle.recommendations,
        interestProfiles: bundle.interestProfiles,
        recommendationStatus: 'done',
      })
    } catch {
      set({ recommendationStatus: 'error' })
    }
  },

  refreshRecommendations: async () => {
    set({ recommendationStatus: 'refreshing' })
    try {
      const bundle = (await window.api.recommendationRefresh()) as RecommendationBundle
      set({
        recommendations: bundle.recommendations,
        interestProfiles: bundle.interestProfiles,
        recommendationStatus: 'done',
      })
    } catch {
      set({ recommendationStatus: 'error' })
    }
  },

  setupStreamListener: () => {
    return window.api.onRecommendationStream((data: unknown) => {
      const bundle = data as RecommendationBundle
      set({
        recommendations: bundle.recommendations,
        interestProfiles: bundle.interestProfiles,
        recommendationStatus: 'done',
      })
    })
  },

  addToReadingList: async (params) => {
    await window.api.readingListAdd(params)
    // Reload reading list to reflect new item
    const result = (await window.api.readingListList()) as { entries: ReadingListItem[]; total: number }
    set({ readingList: result.entries, readingListTotal: result.total })
  },

  removeFromReadingList: async (id) => {
    await window.api.readingListRemove(id)
    const result = (await window.api.readingListList()) as { entries: ReadingListItem[]; total: number }
    set({ readingList: result.entries, readingListTotal: result.total })
  },

  loadReadingList: async (page = 1, perPage = 10) => {
    const result = (await window.api.readingListList(page, perPage)) as { entries: ReadingListItem[]; total: number }
    set({ readingList: result.entries, readingListTotal: result.total })
  },
}))
