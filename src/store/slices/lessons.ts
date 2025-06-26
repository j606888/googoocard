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
    date: string;
    fromTime: string;
    toTime: string;
  }[];
  studentIds: number[];
  answers: Answer[];
}
