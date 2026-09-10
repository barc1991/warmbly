// Built-in starter templates. Picked from the editor when the user does
// not want to start blank. The copy is intentionally conversational so
// the saved template feels like something a person wrote, not a tool.
//
// Editing notes:
//  - keep variables in the {{.FirstName}} form so they line up with the
//    backend renderer in internal/app/template/service.go
//  - sign-offs use [your name] as a placeholder the user replaces once

export interface TemplatePreset {
    id: string;
    label: string;
    tag: string;
    description: string;
    name: string;
    subject: string;
    body_plain: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
    {
        id: "cold-intro",
        label: "פנייה קרה",
        tag: "מכירות",
        description: "פנייה ראשונה, ללא היכרות מוקדמת",
        name: "פנייה קרה · מוצר",
        subject: "שאלה קצרה, {{.FirstName}}",
        body_plain:
`היי {{.FirstName}},

קראתי קצת על מה ש-{{.Company}} עושים וחשבתי שכדאי להשאיר הודעה קצרה. אנחנו עוזרים לצוותים כמו שלכם לפתור את [הבעיה שאתם פותרים], בדרך כלל בלי להוסיף כלים מיותרים למערך הקיים.

מתאים לתאם שיחה קצרה של 15 דקות בשבוע הבא כדי לבדוק התאמה? אשמח לשלוח כמה מועדים שנוחים לי.

תודה,
[השם שלך]`,
    },
    {
        id: "follow-up",
        label: "מעקב",
        tag: "מכירות",
        description: "תזכורת לאחר 3 ימים ללא מענה",
        name: "מעקב · 3 ימים",
        subject: "המשך: שאלה קצרה",
        body_plain:
`היי {{.FirstName}},

רק מקפיץ את ההודעה למקרה שהיא נבלעה במהלך השבוע. הכל בסדר גמור אם העיתוי לא מתאים כרגע, מבין לגמרי.

עדיין אשמח להציג בקצרה איך אנחנו יכולים לעזור אם יש לך 15 דקות פנויות.

תודה,
[השם שלך]`,
    },
    {
        id: "soft-close",
        label: "סגירה רכה",
        tag: "מכירות",
        description: "הודעה אחרונה ברצף, ללא לחץ",
        name: "מעקב אחרון · סגירה רכה",
        subject: "האם לסגור את הפנייה?",
        body_plain:
`היי {{.FirstName}},

לא שמעתי ממך אז אניח לזה בינתיים. אין שום בעיה, העיתוי הנכון חשוב יותר מכל הצעה.

אם משהו ישתנה בהמשך הדרך, תמיד אפשר ליצור איתי קשר.

כל טוב,
[השם שלך]`,
    },
    {
        id: "re-engage",
        label: "חידוש קשר",
        tag: "טיפוח",
        description: "פנייה מחודשת לאחר תקופה שקטה",
        name: "חידוש קשר · 30 יום",
        subject: "עדיין רלוונטי עבורכם?",
        body_plain:
`היי {{.FirstName}},

עבר זמן מאז ששוחחנו לאחרונה. כמה דברים השתנו אצלנו שעשויים להתאים מאוד לצרכים של {{.Company}}.

תרצה שאשלח עדכון קצר על מה שחדש, או שעדיף לוותר כרגע?

תודה,
[השם שלך]`,
    },
    {
        id: "meeting-confirm",
        label: "אישור פגישה",
        tag: "תפעול",
        description: "אישור שיחה שכבר נקבעה ביומן",
        name: "אישור פגישה",
        subject: "מצפה לשיחה שלנו",
        body_plain:
`היי {{.FirstName}},

רק מוודא את מועד השיחה שלנו. הזימון ליומן כבר נשלח לתיבת הדואר שלך.

אם צץ משהו ותרצה להזיז את המועד, רק תעדכן אותי ונמצא זמן חלופי.

נדבר בקרוב,
[השם שלך]`,
    },
    {
        id: "thanks-reply",
        label: "תשובת תודה",
        tag: "תשובה",
        description: "הכרת תודה על מענה ושאלה ממוקדת",
        name: "תודה על המענה",
        subject: "תודה על התשובה",
        body_plain:
`היי {{.FirstName}},

תודה שחזרת אלי, מעריך את זה מאוד.

שאלה קצרה להמשך: [שאלה אחת ספציפית שמקדמת את הצעד הבא]. ברגע שיהיה לי את הפרט הזה, אוכל להכין הצעה שימושית ומדויקת עבורכם.

תודה,
[השם שלך]`,
    },
    {
        id: "polite-no",
        label: "מענה מנומס לסירוב",
        tag: "תשובה",
        description: "סגירת שיחה בנימוס וברוח טובה",
        name: "מענה מנומס · תודה בכל מקרה",
        subject: "תודה שעדכנת אותי",
        body_plain:
`היי {{.FirstName}},

אין שום בעיה, תודה על הכנות והעדכון. אם דברים ישתנו בעתיד, אשמח להיות בקשר.

שיהיה המשך שבוע מצוין,
[השם שלך]`,
    },
    {
        id: "intro-ask",
        label: "בקשת הפניה",
        tag: "טיפוח",
        description: "בקשה להפניה לאיש קשר מתאים בארגון",
        name: "בקשת הפניה",
        subject: "טובה קטנה",
        body_plain:
`היי {{.FirstName}},

שאלה קטנה, האם יש מישהו בצוות שלכם שמטפל ב-[תחום / נושא]? אוכל לפנות אליו בקצרה וביעילות, רק אשמח לשם ואני כבר אמשיך משם.

תודה רבה בכל מקרה,
[השם שלך]`,
    },
];
