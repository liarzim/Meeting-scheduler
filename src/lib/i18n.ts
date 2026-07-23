export type Language = 'en' | 'he';

export type TranslationKey = keyof typeof translations.en;

export const translations = {
  en: {
    // Header & Navigation
    'nav.dashboard': 'Organizer Dashboard',
    'nav.home': 'Home',
    'nav.backToDashboard': 'Back to Dashboard',
    'lang.english': 'English 🇺🇸',
    'lang.hebrew': 'עברית 🇮🇱',

    // Dashboard
    'dashboard.title': 'Organizer Dashboard',
    'dashboard.subtitle': 'Manage your meeting schedules, generate invitation links, and review participant availability heatmaps.',
    'dashboard.hubBadge': 'Organizer Hub',
    'dashboard.createBtn': '+ Create New Meeting',
    'dashboard.yourMeetings': 'Your Meetings',
    'dashboard.liveSync': 'Live Data Sync',
    'dashboard.viewHeatmap': 'View Heatmap & Detail',
    'dashboard.copyLink': 'Copy Share Link',
    'dashboard.statusOpen': 'OPEN',
    'dashboard.statusScheduled': 'SCHEDULED',
    'dashboard.responses': 'Responses',
    'dashboard.submitted': 'Submitted',
    'dashboard.bestMatch': 'Best Match',
    'dashboard.bestSlot': 'Optimal Slot',

    // Week Navigation
    'week.prev': '← Previous Week',
    'week.next': 'Next Week →',
    'week.current': 'Current Week',

    // Modal
    'modal.createTitle': 'Create New Meeting',
    'modal.titleLabel': 'Meeting Title *',
    'modal.titlePlaceholder': 'e.g. Q3 Architecture Sync',
    'modal.descLabel': 'Description / Notes',
    'modal.descPlaceholder': 'Brief agenda or purpose for the attendees...',
    'modal.slugLabel': 'Generated Shareable Slug',
    'modal.slugHelp': 'Unique URL path for participant access.',
    'modal.cancel': 'Cancel',
    'modal.submit': 'Create Meeting',
    'modal.submitting': 'Creating...',

    // Meeting Detail View
    'detail.statusLabel': 'Status',
    'detail.slugLabel': 'Slug',
    'detail.copyLinkBtn': '📋 Copy Share Link',
    'detail.linkCopied': '✓ Link Copied!',
    'detail.participantsTitle': 'Participants',
    'detail.participantsHelp': 'Toggle Required vs Optional to adjust Heatmap',
    'detail.hostTag': 'Host',
    'detail.requiredBtn': '★ Required',
    'detail.optionalBtn': '☆ Optional',
    'detail.inviteTitle': 'Invite Participant',
    'detail.namePlaceholder': 'Full Name',
    'detail.emailPlaceholder': 'Email Address',
    'detail.addPartBtn': '+ Add Participant',

    // Heatmap
    'heatmap.title': 'Weekly Availability Heatmap',
    'heatmap.subtitle': 'Calculating overlap for Required participants',
    'heatmap.match90': '≥90% Match',
    'heatmap.match80': '≥80% Match',
    'heatmap.matchLess80': '<80% Match',
    'heatmap.disabledFriSat': 'Disabled (Fri/Sat)',
    'heatmap.timeCol': 'Time',

    // Days
    'days.sun': 'Sunday',
    'days.mon': 'Monday',
    'days.tue': 'Tuesday',
    'days.wed': 'Wednesday',
    'days.thu': 'Thursday',
    'days.fri': 'Friday',
    'days.sat': 'Saturday',
    'days.shortSun': 'Sun',
    'days.shortMon': 'Mon',
    'days.shortTue': 'Tue',
    'days.shortWed': 'Wed',
    'days.shortThu': 'Thu',
    'days.shortFri': 'Fri',
    'days.shortSat': 'Sat',

    // Invitee Registration
    'invitee.regBadge': 'Invitee Registration',
    'invitee.joinTitle': 'Join',
    'invitee.regSubtitle': 'Enter your details below to submit your availability.',
    'invitee.autofillNotice': '✓ Auto-filled from your saved browser profile',
    'invitee.nameLabel': 'Full Name *',
    'invitee.emailLabel': 'Email Address *',
    'invitee.companyLabel': 'Company / Organization',
    'invitee.phoneLabel': 'Phone Number',
    'invitee.roleLabel': 'Role / Job Title',
    'invitee.continueBtn': 'Continue to Select Availability →',

    // Invitee Calendar
    'cal.editProfile': '← Edit Profile',
    'cal.title': 'Select Your Availability',
    'cal.subtitle': 'Click & drag across 30-minute time slots to select when you are free for',
    'cal.selectedLabel': 'Selected',
    'cal.slotsText': 'slots',
    'cal.hrsText': 'hrs',
    'cal.clearBtn': 'Clear',
    'cal.freeTag': '✓ Free',
    'cal.tip': 'Tip: Drag mouse or finger across multiple boxes to select contiguous blocks quickly.',
    'cal.submitBtn': 'Submit Selected Time Slots',
    'cal.saving': 'Saving Slots...',

    // Confirmation
    'conf.title': 'Availability Submitted!',
    'conf.subtitle': 'Thank you! Your preferred time slots have been saved.',
    'conf.editBtn': '✏ Edit Availability',
    'conf.viewHeatmapBtn': '📊 View Meeting Heatmap',
  },

  he: {
    // Header & Navigation
    'nav.dashboard': 'לוח בקרה למארגן',
    'nav.home': 'דף הבית',
    'nav.backToDashboard': 'חזרה ללוח הבקרה',
    'lang.english': 'English 🇺🇸',
    'lang.hebrew': 'עברית 🇮🇱',

    // Dashboard
    'dashboard.title': 'לוח בקרה למארגן',
    'dashboard.subtitle': 'ניהול תזמוני פגישות, יצירת קישורי הזמנה, וסקירת מפות חום של זמינות משתתפים.',
    'dashboard.hubBadge': 'מרכז מארגנים',
    'dashboard.createBtn': '+ צור פגישה חדשה',
    'dashboard.yourMeetings': 'הפגישות שלך',
    'dashboard.liveSync': 'סנכרון נתונים בזמן אמת',
    'dashboard.viewHeatmap': 'צפה במפת חום ופרטים',
    'dashboard.copyLink': 'העתק קישור לשתוף',
    'dashboard.statusOpen': 'פתוח',
    'dashboard.statusScheduled': 'מתוזמן',
    'dashboard.responses': 'תגובות',
    'dashboard.submitted': 'הגישו זמינות',
    'dashboard.bestMatch': 'התאמה מרבית',
    'dashboard.bestSlot': 'חלון זמן אופטימלי',

    // Week Navigation
    'week.prev': '← שבוע קודם',
    'week.next': 'שבוע הבא →',
    'week.current': 'שבוע נוכחי',

    // Modal
    'modal.createTitle': 'צור פגישה חדשה',
    'modal.titleLabel': 'כותרת הפגישה *',
    'modal.titlePlaceholder': 'לדוגמה: סנכרון ארכיטקטורה רבעון 3',
    'modal.descLabel': 'תיאור / הערות',
    'modal.descPlaceholder': 'אג\'נדה קצרה או מטרת המפגש עבור המשתתפים...',
    'modal.slugLabel': 'מזהה URL ייחודי לשתוף',
    'modal.slugHelp': 'נתיב URL ייחודי לגישת המשתתפים.',
    'modal.cancel': 'ביטול',
    'modal.submit': 'צור פגישה',
    'modal.submitting': 'יוצר...',

    // Meeting Detail View
    'detail.statusLabel': 'סטטוס',
    'detail.slugLabel': 'מזהה',
    'detail.copyLinkBtn': '📋 העתק קישור לשתוף',
    'detail.linkCopied': '✓ הקישור הועתק!',
    'detail.participantsTitle': 'משתתפים',
    'detail.participantsHelp': 'שנה בין חובה לרשות כדי לעדכן את מפת החום',
    'detail.hostTag': 'מארח',
    'detail.requiredBtn': '★ חובה',
    'detail.optionalBtn': '☆ רשות',
    'detail.inviteTitle': 'הזמן משתתף',
    'detail.namePlaceholder': 'שם מלא',
    'detail.emailPlaceholder': 'כתובת אימייל',
    'detail.addPartBtn': '+ הוסף משתתף',

    // Heatmap
    'heatmap.title': 'מפת חום של זמינות שבועית',
    'heatmap.subtitle': 'מחשב חפיפה עבור משתתפי חובה',
    'heatmap.match90': '≥90% התאמה',
    'heatmap.match80': '≥80% התאמה',
    'heatmap.matchLess80': '<80% התאמה',
    'heatmap.disabledFriSat': 'מנוטרל (שישי/שבת)',
    'heatmap.timeCol': 'שעה',

    // Days
    'days.sun': 'יום ראשון',
    'days.mon': 'יום שני',
    'days.tue': 'יום שלישי',
    'days.wed': 'יום רביעי',
    'days.thu': 'יום חמישי',
    'days.fri': 'יום שישי',
    'days.sat': 'יום שבת',
    'days.shortSun': 'א׳',
    'days.shortMon': 'ב׳',
    'days.shortTue': 'ג׳',
    'days.shortWed': 'ד׳',
    'days.shortThu': 'ה׳',
    'days.shortFri': 'ו׳',
    'days.shortSat': 'ש׳',

    // Invitee Registration
    'invitee.regBadge': 'הרשמת משתתף',
    'invitee.joinTitle': 'הצטרף ל-',
    'invitee.regSubtitle': 'הזן את פרטיך להלן כדי להגיש את זמינותך.',
    'invitee.autofillNotice': '✓ אוכלס אוטומטית מהפרופיל השמור בדפדפן',
    'invitee.nameLabel': 'שם מלא *',
    'invitee.emailLabel': 'כתובת אימייל *',
    'invitee.companyLabel': 'חברה / ארגון',
    'invitee.phoneLabel': 'מספר טלפון',
    'invitee.roleLabel': 'תפקיד / הגדרת איוב',
    'invitee.continueBtn': 'המשך לבחירת זמינות ←',

    // Invitee Calendar
    'cal.editProfile': 'ערוך פרופיל →',
    'cal.title': 'בחר את הזמינות שלך',
    'cal.subtitle': 'לחץ וגרור על גבי משבצות של 30 דקות כדי לבחור מתי אתה פנוי עבור',
    'cal.selectedLabel': 'נבחרו',
    'cal.slotsText': 'משבצות',
    'cal.hrsText': 'שעות',
    'cal.clearBtn': 'ניקוי',
    'cal.freeTag': '✓ פנוי',
    'cal.tip': 'טיפ: גורר את העכבר או האצבע מעל מספר משבצות כדי לבחור טווח רציף במהירות.',
    'cal.submitBtn': 'שלח משבצות זמן שנבחרו',
    'cal.saving': 'שומר משבצות...',

    // Confirmation
    'conf.title': 'הזמינות נשלחה בהצלחה!',
    'conf.subtitle': 'תודה! משבצות הזמן המועדפות עליך נשמרו.',
    'conf.editBtn': '✏ ערוך זמינות',
    'conf.viewHeatmapBtn': '📊 צפה במפת חום של הפגישה',
  },
};
