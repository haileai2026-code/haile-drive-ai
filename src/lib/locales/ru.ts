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
  consentTitle: "Согласие на измерение с помощью камеры",
  consentIntro: "В ходе этой оценки камера будет использоваться для измерения пульса и анализа выражения лица.",
  consentWhyLabel: "Зачем",
  consentWhy: "Чтобы оценить вашу готовность к профессиональному экзамену по вождению.",
  consentRetentionLabel: "Хранение данных",
  consentRetention: "Эти данные обрабатываются только для данной оценки и хранятся в течение срока, необходимого для процесса вашей сертификации.",
  consentCheckbox: "Я понимаю и даю согласие на измерение пульса и анализ выражения лица с помощью камеры для этой оценки.",
  consentContinue: "Продолжить",
  consentDecline: "Я не согласен",
  consentDeclinedTitle: "Оценка не начата",
  consentDeclinedMsg: "Ничего страшного — без вашего согласия мы не можем провести оценку с камерой. Измерения не проводились, камера не открывалась. Вы можете вернуться в любое время или обратиться в школу за альтернативой.",
  consentBackHome: "На главную",
};

export default dict;
