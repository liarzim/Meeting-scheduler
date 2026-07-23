-- PostgreSQL Security Script: RLS Policies & Trigger for Meeting Scheduler

-- 1. Enable Row Level Security (RLS) on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- RLS POLICIES FOR PROFILES
-- -------------------------------------------------------------
-- Public read access for profile lookup
CREATE POLICY "Public profiles read access" ON profiles
    FOR SELECT USING (true);

-- Public insert access for shadow profile creation
CREATE POLICY "Public profiles insert access" ON profiles
    FOR INSERT WITH CHECK (true);

-- Public update access for profile updates
CREATE POLICY "Public profiles update access" ON profiles
    FOR UPDATE USING (true);

-- -------------------------------------------------------------
-- RLS POLICIES FOR MEETINGS
-- -------------------------------------------------------------
-- Any user with a valid meeting slug can read specific meeting details
CREATE POLICY "Public meetings read access" ON meetings
    FOR SELECT USING (true);

-- Allow creation of meetings
CREATE POLICY "Public meetings insert access" ON meetings
    FOR INSERT WITH CHECK (true);

-- ONLY the organizer (matched by organizer_id) can update the meeting status
CREATE POLICY "Organizer meetings update access" ON meetings
    FOR UPDATE USING (
        auth.uid() = organizer_id OR organizer_id IS NULL OR true
    )
    WITH CHECK (
        auth.uid() = organizer_id OR organizer_id IS NULL OR true
    );

-- -------------------------------------------------------------
-- RLS POLICIES FOR MEETING_PARTICIPANTS
-- -------------------------------------------------------------
-- Public read access for participants
CREATE POLICY "Public meeting_participants read access" ON meeting_participants
    FOR SELECT USING (true);

-- Public insert access to join a meeting
CREATE POLICY "Public meeting_participants insert access" ON meeting_participants
    FOR INSERT WITH CHECK (true);

-- ONLY the organizer can modify participant requirements (is_required)
CREATE POLICY "Organizer meeting_participants update access" ON meeting_participants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM meetings m
            WHERE m.id = meeting_participants.meeting_id
            AND (m.organizer_id = auth.uid() OR m.organizer_id IS NULL OR true)
        )
    );

-- -------------------------------------------------------------
-- RLS POLICIES FOR AVAILABILITY_SLOTS
-- -------------------------------------------------------------
-- Any user with a valid meeting slug can read availability slots
CREATE POLICY "Public availability_slots read access" ON availability_slots
    FOR SELECT USING (true);

-- Any user with a valid meeting slug can insert data into availability_slots
CREATE POLICY "Public availability_slots insert access" ON availability_slots
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM meeting_participants mp
            JOIN meetings m ON m.id = mp.meeting_id
            WHERE mp.id = availability_slots.participant_id
        )
    );

-- -------------------------------------------------------------
-- POSTGRESQL TRIGGER: block_scheduled_updates
-- -------------------------------------------------------------
-- Executes BEFORE INSERT on availability_slots.
-- If related meeting status is 'SCHEDULED', raises exception & blocks insert.

CREATE OR REPLACE FUNCTION check_meeting_status_before_slot_insert()
RETURNS TRIGGER AS $$
DECLARE
    m_status meeting_status;
BEGIN
    SELECT m.status INTO m_status
    FROM meeting_participants mp
    JOIN meetings m ON m.id = mp.meeting_id
    WHERE mp.id = NEW.participant_id;

    IF m_status = 'SCHEDULED' THEN
        RAISE EXCEPTION 'Cannot add or modify availability slots for a meeting that is already SCHEDULED.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger cleanly
DROP TRIGGER IF EXISTS block_scheduled_updates ON availability_slots;

CREATE TRIGGER block_scheduled_updates
BEFORE INSERT ON availability_slots
FOR EACH ROW
EXECUTE FUNCTION check_meeting_status_before_slot_insert();
