import { api } from "../api";
import { Student } from "./students";

export interface Card {
  id: number;
  name: string;
  price: number;
  sessions: number;
  expiredAt: Date | null;
  purchasedCount: number;
}

export interface UnpaidStudentCard {
  id: number;
  studentId: number;
  cardId: number;
  paid: boolean;
  student: Student;
  card: Card;
}

const cardsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCards: builder.query<{ activeCards: Card[]; expiredCards: Card[] }, void>({
      query: () => "cards",
      providesTags: ["Card"],
    }),
    createCard: builder.mutation<Card, { name: string; price: number; sessions: number }>({
      query: (card) => ({
        url: "cards",
        method: "POST",
        body: card,
      }),
      invalidatesTags: ["Card"],
    }),
    deleteCard: builder.mutation<Card, number>({
      query: (id) => ({
        url: `cards/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Card"],
    }),
    expireCard: builder.mutation<Card, number>({
      query: (id) => ({
        url: `cards/${id}/expire`,
        method: "POST",
      }),
      invalidatesTags: ["Card"],
    }),
    enableCard: builder.mutation<Card, number>({
      query: (id) => ({
        url: `cards/${id}/enable`,
        method: "POST",
      }),
      invalidatesTags: ["Card"],
    }),
    updateCard: builder.mutation<Card, { id: number; name: string; price: number; sessions: number }>({
      query: ({ id, name, price, sessions }) => ({
        url: `cards/${id}`,
        method: "PATCH",
        body: { name, price, sessions },
      }),
      invalidatesTags: ["Card"],
    }),
    unpaidStudentCards: builder.query<UnpaidStudentCard[], void>({
      query: () => "cards/unpaid",
      providesTags: ["Card"],
    }),
  }),
});
export const {
  useGetCardsQuery,
  useCreateCardMutation,
  useDeleteCardMutation,
  useExpireCardMutation,
  useEnableCardMutation,
  useUpdateCardMutation,
  useUnpaidStudentCardsQuery,
} = cardsApi;
