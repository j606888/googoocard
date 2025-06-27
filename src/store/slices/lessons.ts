import { api } from "../api";

export interface Answer {
  studentId: number;
  createNewCard: boolean;
  selectedCardId: number | null;
  cardSessions: string;
  cardPrice: string;
}

export interface DraftLesson {
  lessonName: string;
  teacherIds: number[];
  cardIds: number[];
  periods: {
    startTime: string;
    endTime: string;
  }[];
  studentIds: number[];
  answers: Answer[];
}

const lessonsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createLesson: builder.mutation<void, DraftLesson>({
      query: (draftLesson) => ({
        url: "lessons",
        method: "POST",
        body: draftLesson,
      }),
    }),
  }),
});

export const { useCreateLessonMutation } = lessonsApi;