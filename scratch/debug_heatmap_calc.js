const path = require('path');
const projectRoot = 'c:/Users/micha/Downloads/Antigravity AI/Meeting Scheduler';
const { createClient } = require(path.join(projectRoot, 'node_modules/@supabase/supabase-js'));

const supabaseUrl = 'https://skeyhqftqhnpkztcisjx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrZXlocWZ0cWhucGt6dGNpc2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzE5MjgsImV4cCI6MjEwMDMwNzkyOH0.qRlXluYljAksF52OaheQXskUAixZhYVQK5lxsXcZLow';

const supabase = createClient(supabaseUrl, supabaseKey);

function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekDates(offsetWeeks = 0) {
  const now = new Date();
  const currentDay = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - currentDay + offsetWeeks * 7);
  sunday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    return day;
  });
}

// 7:00 AM to 10:00 PM (30 slots of 30 minutes each)
const TIME_SLOTS = Array.from({ length: 30 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return { timeString, totalMinutes, hours, minutes };
});

async function debugHeatmap() {
  const meetingId = '8561ca4c-f402-42f0-a551-9274e8d7c064';

  const { data: dbData } = await supabase
    .from('meetings')
    .select('*, meeting_participants(*, profiles(*), availability_slots(*))')
    .eq('id', meetingId)
    .single();

  const dbParticipants = dbData.meeting_participants
    .filter((mp) => {
      const em = (mp.profiles?.email || '').toLowerCase();
      return em !== 'organizer@company.com' && em !== 'host@company.com';
    })
    .map((mp) => ({
      id: mp.id,
      meeting_id: mp.meeting_id,
      profile_id: mp.profile_id,
      is_required: mp.is_required !== false,
      profile: mp.profiles,
      availability: (mp.availability_slots || []).map((s) => {
        let slotKey = s.slot_key;
        if (!slotKey && s.start_time) {
          const d = new Date(s.start_time);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          slotKey = `${y}-${m}-${day}_${timeStr}`;
        }
        return { ...s, slot_key: slotKey };
      }),
    }));

  console.log(`Total participants loaded: ${dbParticipants.length}`);
  dbParticipants.forEach((p) => {
    console.log(`- ${p.profile.full_name} (${p.profile.email}): is_required=${p.is_required}, slots count=${p.availability.length}`);
    if (p.availability.length > 0) {
      console.log(`  Sample slots:`, p.availability.slice(0, 3).map(s => s.slot_key));
    }
  });

  const weekDates = getWeekDates(0);
  console.log('\nCurrent week dates:');
  weekDates.forEach((d, i) => console.log(`  Day ${i}: ${getDateKey(d)}`));

  const daysConfig = [
    { key: 0, date: weekDates[0] },
    { key: 1, date: weekDates[1] },
    { key: 2, date: weekDates[2] },
    { key: 3, date: weekDates[3] },
    { key: 4, date: weekDates[4] },
    { key: 5, date: weekDates[5] },
    { key: 6, date: weekDates[6] },
  ];

  const requiredParticipants = dbParticipants.filter((p) => p.is_required !== false);
  console.log(`\nRequired participants: ${requiredParticipants.length}`);

  let nonZeroSlots = 0;
  daysConfig.forEach((day) => {
    TIME_SLOTS.forEach((slot) => {
      const targetSlotKey = `${getDateKey(day.date)}_${slot.timeString}`;
      const availableNames = [];

      requiredParticipants.forEach((participant) => {
        if (!participant.availability || participant.availability.length === 0) return;

        const isMatch = participant.availability.some((av) => {
          if (av.slot_key && av.slot_key === targetSlotKey) return true;
          const start = new Date(av.start_time);
          const isSameDay =
            start.getFullYear() === day.date.getFullYear() &&
            start.getMonth() === day.date.getMonth() &&
            start.getDate() === day.date.getDate();
          if (!isSameDay) return false;
          const startMinutes = start.getHours() * 60 + start.getMinutes();
          return slot.totalMinutes >= startMinutes && slot.totalMinutes < startMinutes + 30;
        });

        if (isMatch) {
          availableNames.push(participant.profile.full_name);
        }
      });

      if (availableNames.length > 0) {
        nonZeroSlots++;
        const pct = Math.round((availableNames.length / requiredParticipants.length) * 100);
        console.log(`Slot ${targetSlotKey}: ${availableNames.length}/${requiredParticipants.length} (${pct}%) -> [${availableNames.join(', ')}]`);
      }
    });
  });

  console.log(`\nTotal non-zero slots found on current week: ${nonZeroSlots}`);
}

debugHeatmap();
