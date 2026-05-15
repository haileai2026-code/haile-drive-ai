# תוכנית — סוכן AI לבעלים `/admin/ai-agent`

## 1. Secret
- בקשה מהמשתמש להוסיף `ANTHROPIC_API_KEY` (דרך `add_secret`) — חובה לפני הפעלה.
- מודל: `claude-haiku-4-5` (Anthropic Messages API ישירות, לא דרך Lovable Gateway — Gateway לא תומך ב-Claude).

## 2. Server function — `src/lib/ai-agent.functions.ts`
`aiAgentChat` (POST) עם `requireSupabaseAuth` + בדיקת role=`owner` (אחרת 403).

קלט (Zod):
- `message: string` (1..4000)
- `history: Array<{role:'user'|'assistant', content:string}>` (max 30)

זרימה:
1. **שליפת snapshot מצומצם** (read-only, service-role דרך client.server, אבל רק אחרי בדיקת owner) — מספרים בלבד, לא PII מיותר:
   - מועמדים: count לפי `status`, count לפי `city_id`, רשימת 20 אחרונים (שם/סטטוס/עיר/עדכון אחרון)
   - כיתות: count + שמות
   - exam_results: count, ממוצע ציון, % עוברים (passed=true)
   - feedback_reports: count לפי status
   - contact_messages: count `is_read=false`
   - attendance: % נוכחות 30 ימים אחרונים
2. בנה system prompt עם ה-snapshot כ-JSON קומפקטי + ההנחיות שהמשתמש סיפק.
3. POST ל-`https://api.anthropic.com/v1/messages` עם `x-api-key`, `anthropic-version: 2023-06-01`, model=`claude-haiku-4-5`, max_tokens=1024, system+messages.
4. טיפול שגיאות: 401/429/402/אחר → `{error, text:''}`.
5. החזר `{text}`.

הערה: בגרסה ראשונה הסוכן **קורא בלבד** ועונה בטקסט. פעולות עדכון ("עדכן את X לשלב Test") יוסברו כהוראה למשתמש לבצע ידנית — מניעת סיכוני אבטחה. אם תרצה כתיבה אמיתית בעתיד — נוסיף tool-calling עם אישור.

## 3. דף — `src/routes/admin.ai-agent.tsx`
- עטוף ב-`AdminShell` עם `roles=["owner"]`, title "🤖 סוכן AI".
- State: `messages`, `input`, `loading`.
- 3 כפתורי quick action שממלאים input ושולחים: "דוח יומי" / "מועמדים ממתינים" / "סיכום pipeline".
- Chat bubbles: user (זהב מימין) / assistant (כרטיס שחור משמאל) — RTL, מובייל-פירסט.
- Markdown rendering לתשובות (react-markdown כבר ב-deps אם קיים, אחרת טקסט פשוט עם `whitespace-pre-wrap`).
- Typing indicator (שלוש נקודות מנצנצות) בזמן `loading`.
- textarea + כפתור שליחה (Enter=שלח, Shift+Enter=שורה).
- auto-scroll לתחתית.

## 4. ניווט
ב-`src/components/AdminShell.tsx` להוסיף ל-`NAV` (אחרי dashboard):
```ts
{ to: "/admin/ai-agent", icon: Sparkles, label: "🤖 סוכן AI", roles: ["owner"] }
```

## 5. עיצוב
שחור-זהב קיים (`bg-night`, `text-gold`, `border-gold/40`) — עקבי עם שאר הפאנל.

## 6. בדיקה
- ללא secret → הודעת שגיאה ידידותית "חסר ANTHROPIC_API_KEY".
- non-owner → 403.
- שאלה "כמה מועמדים יש לי?" → תשובה עם מספר מדויק מה-snapshot.

---

**שאלה אחת לפני ביצוע:** ANTHROPIC_API_KEY עדיין לא קיים ב-secrets. אאשר ואבקש אותו ממך בתחילת הביצוע — מתאים?
