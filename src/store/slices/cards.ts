import { api } from "../api";

export interface Card {
  id: number;
  name: string;
  price: number;
  sessions: number;
  expiredAt: Date | null;
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
  }),
});
export const {
  useGetCardsQuery,
  useCreateCardMutation,
  useDeleteCardMutation,
  useExpireCardMutation,
  useEnableCardMutation,
} = cardsApi;
