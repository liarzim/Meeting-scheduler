const path = require('path');
const projectRoot = 'c:/Users/micha/Downloads/Antigravity AI/Meeting Scheduler';
const { createClient } = require(path.join(projectRoot, 'node_modules/@supabase/supabase-js'));

const supabaseUrl = 'https://skeyhqftqhnpkztcisjx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrZXlocWZ0cWhucGt6dGNpc2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzE5MjgsImV4cCI6MjEwMDMwNzkyOH0.qRlXluYljAksF52OaheQXskUAixZhYVQK5lxsXcZLow';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanTypoParticipants() {
  const meetingId = '8561ca4c-f402-42f0-a551-9274e8d7c064';

  // 1. Remove 26c6848e-f6ac-4888-aaf4-241c2c62099c (amir.liarzu@gmail.com - 0 slots)
  const { data: del1, error: err1 } = await supabase
    .from('meeting_participants')
    .delete()
    .eq('id', '26c6848e-f6ac-4888-aaf4-241c2c62099c');
  console.log('Deleted amir.liarzu@gmail.com:', del1, err1);

  // 2. Remove 74b297a5-e950-451e-9c0e-5e82cecfd9e5 (liron.liarzi@gmail.com - 0 slots, duplicate of liron.liarzi@gamil.com)
  const { data: del2, error: err2 } = await supabase
    .from('meeting_participants')
    .delete()
    .eq('id', '74b297a5-e950-451e-9c0e-5e82cecfd9e5');
  console.log('Deleted liron.liarzi@gmail.com duplicate:', del2, err2);

  // 3. For hila.liarzi1@gmail.com (0 slots), set is_required: false or keep as optional until she submits
  const { data: updHila, error: errHila } = await supabase
    .from('meeting_participants')
    .update({ is_required: false })
    .eq('id', 'a7874783-efdd-4a11-8ac6-c6662df349b8');
  console.log('Set hila to optional:', updHila, errHila);
}

cleanTypoParticipants();
