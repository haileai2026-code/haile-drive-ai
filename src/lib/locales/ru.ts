import type { StringKey } from "./en";

// Russian — partial translation. Missing keys fall back to English.
const dict: Partial<Record<StringKey, string>> = {
  tagline: "Учитесь профессиональному вождению с ИИ на вашем языке.",
  getStarted: "Начать",
  login: "Войти",
  dashboard: "Панель",
  lessons: "Уроки",
  aiTeacher: "ИИ преподаватель",
  quiz: "Тест",
  community: "Сообщество",
  profile: "Профиль",
  welcome: "С возвращением",
  chooseLanguage: "Выберите язык",
  continueIn: "Продолжить на",
  beta: "Бета",
};

export default dict;
