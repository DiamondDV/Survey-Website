export interface Question {
  id: string;
  number: number;
  type: 'single' | 'multiple';
  text: string;
  subtext?: string;
  options: {
    key: string;
    text: string;
  }[];
}

export interface SurveyAnswers {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string[];
  q6: string;
  q7: string;
  q8: string;
  q9: string;
  q10: string;
}

export interface SurveyResponse {
  id: string;
  timestamp: string;
  answers: SurveyAnswers;
  synced: boolean;
}

export interface AppConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  adminEmail: string | null;
  hasToken: boolean;
}

export const SURVEY_QUESTIONS: Question[] = [
  {
    id: "q1",
    number: 1,
    type: "single",
    text: "What grade are you in?",
    options: [
      { key: "A", text: "6 - 8" },
      { key: "B", text: "8 - 9" },
      { key: "C", text: "10 - 12" },
      { key: "D", text: "Other" }
    ]
  },
  {
    id: "q2",
    number: 2,
    type: "single",
    text: "How many hours do you study per week?",
    options: [
      { key: "A", text: "<2" },
      { key: "B", text: "2-5" },
      { key: "C", text: "5-10" },
      { key: "D", text: "10+" }
    ]
  },
  {
    id: "q3",
    number: 3,
    type: "single",
    text: "How often do you delay studying even when you know you should start?",
    options: [
      { key: "A", text: "Never" },
      { key: "B", text: "Rarely" },
      { key: "C", text: "Sometimes" },
      { key: "D", text: "Often" },
      { key: "E", text: "Very Often" }
    ]
  },
  {
    id: "q4",
    number: 4,
    type: "single",
    text: "When sitting down to study, how difficult is it to decide what to start with?",
    options: [
      { key: "A", text: "Very Easy" },
      { key: "B", text: "Easy" },
      { key: "C", text: "Neutral" },
      { key: "D", text: "Difficult" },
      { key: "E", text: "Very Difficult" }
    ]
  },
  {
    id: "q5",
    number: 5,
    type: "multiple",
    text: "What usually prevents you from starting a study session? (Select all that apply)",
    subtext: "Choose as many as you like",
    options: [
      { key: "A", text: "Too much work" },
      { key: "B", text: "Don't know where to start" },
      { key: "C", text: "Lack of motivation" },
      { key: "D", text: "Phone/social media distractions" },
      { key: "E", text: "Tiredness" },
      { key: "F", text: "Other" }
    ]
  },
  {
    id: "q6",
    number: 6,
    type: "single",
    text: "Have you ever opened social media instead of studying because you felt overwhelmed by deciding what to do?",
    options: [
      { key: "A", text: "Yes" },
      { key: "B", text: "No" }
    ]
  },
  {
    id: "q7",
    number: 7,
    type: "single",
    text: "How often does this happen?",
    options: [
      { key: "A", text: "Never" },
      { key: "B", text: "Rarely" },
      { key: "C", text: "Sometimes" },
      { key: "D", text: "Often" },
      { key: "E", text: "Very Often" }
    ]
  },
  {
    id: "q8",
    number: 8,
    type: "single",
    text: "How useful would an app be that automatically creates a study plan based on your exams, weak subjects, and available time?",
    options: [
      { key: "A", text: "Not useful" },
      { key: "B", text: "Slightly useful" },
      { key: "C", text: "Moderately useful" },
      { key: "D", text: "Useful" },
      { key: "E", text: "Very useful" }
    ]
  },
  {
    id: "q9",
    number: 9,
    type: "single",
    text: "Would you try such an app?",
    options: [
      { key: "A", text: "Yes" },
      { key: "B", text: "Maybe" },
      { key: "C", text: "No" }
    ]
  },
  {
    id: "q10",
    number: 10,
    type: "single",
    text: "What is the biggest challenge you face when starting to study?",
    options: [
      { key: "A", text: "Not knowing where to start" },
      { key: "B", text: "Getting distracted" },
      { key: "C", text: "Lack of motivation" },
      { key: "D", text: "Too much work" },
      { key: "E", text: "Poor planning" },
      { key: "F", text: "Other" }
    ]
  }
];
