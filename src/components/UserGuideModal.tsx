'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const { t, dir, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'steps' | 'mobile' | 'faq'>('steps');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto transform transition-all animate-scaleUp text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-sm">
              <span>📖</span>
              <span>{language === 'he' ? 'מרכז הדרכה ועזרה' : 'Help & User Guide'}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white pt-1">
              {language === 'he' ? 'מדריך למשתמש: מתזמן הפגישות' : 'User Guide: Smart Meeting Scheduler'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'he'
                ? 'כל מה שצריך לדעת כדי לתאם פגישות מרובות משתתפים בקלות ובמהירות'
                : 'Everything you need to schedule multi-participant meetings with zero friction'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('steps')}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'steps'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🧭</span>
            <span>{language === 'he' ? 'שלבי השימוש' : 'Key Steps'}</span>
          </button>

          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'mobile'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>📱</span>
            <span>{language === 'he' ? 'מדריך מובייל' : 'Mobile Guide'}</span>
          </button>

          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'faq'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>💡</span>
            <span>{language === 'he' ? 'טיפים ושאלות' : 'Tips & FAQ'}</span>
          </button>
        </div>

        {/* Tab 1: Main Steps */}
        {activeTab === 'steps' && (
          <div className="space-y-4 text-xs">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                  1
                </span>
                <span>{language === 'he' ? 'יצירת פגישה חדשה (מארגן / Host)' : 'Creating a New Meeting (Host)'}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'he'
                  ? 'לחצו על "+ צור פגישה חדשה" בלוח הבקרה. הזינו את שם הפגישה, מטרת הפגישה (מופיעה בראש עמוד ההרשמה), ואת פרטי המארגן (שם ומייל חובה). תקבלו קישור שיתוף ייחודי לשליחה למשתתפים.'
                  : 'Click "+ Create New Meeting" in the dashboard. Enter meeting title, purpose description, and host details (mandatory name & email). A unique share link is generated instantly.'}
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                  2
                </span>
                <span>{language === 'he' ? 'הצטרפות ורישום משתתף (Guest Registration)' : 'Guest Registration & Country Flags'}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'he'
                  ? 'המשתתף פותח את הקישור, קורא את מטרת הפגישה, ומזין שם, מייל, ומספר טלפון עם קידומת מדינה גרפית (🇮🇱 +972 ברירת מחדל). המספר מנוקה ומחובר אוטומטית לפורמט בינלאומי תקין.'
                  : 'The guest opens the link, reviews the purpose card, and fills in name, work email, and phone with an international country flag dropdown (🇮🇱 +972 default).'}
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                  3
                </span>
                <span>{language === 'he' ? 'סימון זמינות ושמירה ביומן' : 'Marking Availability & Saving'}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'he'
                  ? 'סמנו את השעות שבהן אתם פנויים בלוח השבועי. משבצות עם סמל 👥 מציגות משתתפים שכבר פנויים בשעה זו. בסיום, לחצו על הכפתור הירוק "שמור והגש זמינות" לשמירת הנתונים בענן!'
                  : 'Select your open slots across the weekly grid. Slots with 👥 show other available teammates. When finished, click the green "Submit Availability" button to save!'}
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">
                  4
                </span>
                <span>{language === 'he' ? 'מפת החום וצ\'אט WhatsApp ישיר' : 'Heatmap & WhatsApp Direct Chat'}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'he'
                  ? 'בלוח הבקרה, מפת החום מציגה התאמות (100% ירוק מלא). לחיצה על כל משבצת פותחת פופ-אפ עם שמות המשתתפים, כפתור WhatsApp ישיר (ללא צורך בשמירת איש קשר), וכפתור העתקת מיילים של הלא זמינים.'
                  : 'On the heatmap, 100% overlap is marked in solid green. Click any slot to view attendee cards, open a direct WhatsApp chat (no contact saving needed), or copy emails.'}
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Mobile Guide */}
        {activeTab === 'mobile' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/80 space-y-3">
              <div className="font-extrabold text-sm text-blue-950 dark:text-blue-200 flex items-center gap-2">
                <span>📱</span>
                <span>{language === 'he' ? 'טיפים לבחירת זמנים בנייד (סמארטפון / טאבלט)' : 'Mobile & Touch Screen Interaction Guide'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>👆</span>
                    <span>{language === 'he' ? '1. לחיצה קצרה (Tap)' : '1. Quick Tap'}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {language === 'he'
                      ? 'לחיצה בודדת על כל משבצת מסמנת אותה בצבע ירוק עם ✓. לחיצה נוספת מבטלת את הסימון.'
                      : 'Tap any slot to toggle availability on (green ✓) or off.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🖐️</span>
                    <span>{language === 'he' ? '2. גרירה ברצף (Drag)' : '2. Drag across Hours'}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {language === 'he'
                      ? 'החליקו את האצבע על פני כמה שעות ברצף כדי לסמן טווח זמנים שלם בבת אחת במהירות.'
                      : 'Drag your finger across several slots to highlight a multi-hour block in seconds.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>💾</span>
                    <span>{language === 'he' ? '3. סרגל שמירה צף (Sticky Bar)' : '3. Floating Save Bar'}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {language === 'he'
                      ? 'כשתגללו בנייד, יופיע סרגל צף בתחתית עם כפתור "שמור והגש זמינות" כדי שלא תשכחו לשמור.'
                      : 'A bottom bar stays visible as you scroll—tap "Submit Availability" to save anytime.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: FAQ & Pro Tips */}
        {activeTab === 'faq' && (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>💬</span>
                <span>
                  {language === 'he'
                    ? 'האם כפתור ה-WhatsApp עובד אם המשתתף לא שמור באנשי הקשר שלי?'
                    : 'Does WhatsApp work if the participant is not in my contacts?'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                {language === 'he'
                  ? 'כן! המערכת מנרמלת את המספר לפורמט בינלאומי מלא (לדוגמה 972522888491), ומפעילה את ה-API הרשמי של וואטסאפ לפתיחת צ\'אט ישיר עם נוסח פנייה מוכן מראש.'
                  : 'Yes! The app converts numbers to full E.164 format and uses the official WhatsApp API to open a direct chat with prefilled meeting details.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>🔄</span>
                <span>
                  {language === 'he'
                    ? 'כיצד משתתף מעדכן את זמינותו אם לוח הזמנים השתנה?'
                    : 'How do I update my availability if my schedule changes?'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                {language === 'he'
                  ? 'נכנסים שוב לאותו קישור של הפגישה, משנים את המשבצות המסומנות ביומן, ולוחצים על "שמור והגש זמינות". השינוי מתעדכן בזמן אמת אצל כולם.'
                  : 'Simply reopen the meeting link, modify your selected slots, and click "Submit Availability". The heatmap syncs in real time.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>📋</span>
                <span>
                  {language === 'he'
                    ? 'איך שולחים תזכורת במייל למי שעדיין לא הגיש זמינות?'
                    : 'How do I email participants who have not responded yet?'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                {language === 'he'
                  ? 'לוחצים על משבצת כלשהי במפת החום, ובראש החלק "משתתפים שלא סימנו זמינות" לוחצים על "📋 העתק מיילים של הלא זמינים" להדבקה מהירה במייל.'
                  : 'Click any slot on the heatmap and click "📋 Copy Unavailable Emails" to grab all pending email addresses.'}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3">
          <div className="text-[11px] text-slate-400">
            {language === 'he' ? 'מתזמן פגישות חכם • גרסה 2.0' : 'Smart Meeting Scheduler • v2.0'}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-md shadow-blue-600/20"
          >
            {language === 'he' ? 'הבנתי, תודה!' : 'Got it, thanks!'}
          </button>
        </div>
      </div>
    </div>
  );
}
