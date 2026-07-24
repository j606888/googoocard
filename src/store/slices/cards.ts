import { DanceType } from "@prisma/client";
import { api } from "../api";

export interface Card {
  id: number;
  name: string;
  price: number;
  isPracticeCard: boolean;
  danceType: DanceType | null;
  sessions: number;
  expiredAt: Date | null;
  purchasedCount: number;
  activeHolders: number;
  totalRevenue: number;
}

export interface CardHolder {
  id: number;
  studentId: number;
  createdAt: string;
  remainingSessions: number;
  totalSessions: number;
  finalPrice: number;
  isPaid: boolean;
  paidAt: string | null;
  student: { id: number; name: string; avatarUrl: string };
  purchasedBy?: { name: string } | null;
}

export interface CardDetail {
  card: {
    id: number;
    name: string;
    price: number;
    sessions: number;
    isPracticeCard: boolean;
    danceType: DanceType | null;
    expiredAt: string | null;
  };
  purchasedCount: number;
  activeHolderCount: number;
  totalRevenue: number;
  holders: CardHolder[];
}

const cardsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCards: builder.query<{ activeCards: Card[]; expiredCards: Card[] }, void>({
      query: () => "cards",
      providesTags: ["Card"],
    }),
    getCardDetail: builder.query<CardDetail, { id: number }>({
      query: ({ id }) => `cards/${id}`,
      providesTags: ["Card", "StudentCard"],
    }),
    createCard: builder.mutation<Card, { name: string; price: number; sessions: number; isPracticeCard: boolean; danceType: DanceType | null }>({
      query: (card) => ({
        url: "cards",
        method: "POST",
        body: card,
      }),
      invalidatesTags: ["Card", "Attendance"],
    }),
    deleteCard: builder.mutation<Card, number>({
      query: (id) => ({
        url: `cards/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Card", "Attendance"],
    }),
    expireCard: builder.mutation<Card, number>({
      query: (id) => ({
        url: `cards/${id}/expire`,
        method: "POST",
      }),
      invalidatesTags: ["Card", "Attendance"],
    }),
    enableCard: builder.mutation<Card, number>({
      query: (id) => ({
        url: `cards/${id}/enable`,
        method: "POST",
      }),
      invalidatesTags: ["Card", "Attendance"],
    }),
    updateCard: builder.mutation<Card, { id: number; name: string; price: number; sessions: number; isPracticeCard: boolean; danceType: DanceType | null }>({
      query: ({ id, name, price, sessions, isPracticeCard, danceType }) => ({
        url: `cards/${id}`,
        method: "PATCH",
        body: { name, price, sessions, isPracticeCard, danceType },
      }),
      invalidatesTags: ["Card", "Attendance"],
    }),
  }),
});
export const {
  useGetCardsQuery,
  useGetCardDetailQuery,
  useCreateCardMutation,
  useDeleteCardMutation,
  useExpireCardMutation,
  useEnableCardMutation,
  useUpdateCardMutation,
} = cardsApi;
