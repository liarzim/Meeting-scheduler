-- SQL Initialization script for Multi-Tenant Meeting Coordination App
-- Canonical Data Model

-- Create custom enum for meeting status
DO $$ BEGIN
    CREATE TYPE meeting_status AS ENUM ('OPEN', 'SCHEDULED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    company TEXT,
    phone_number TEXT,
    is_organizer BOOLEAN NOT NULL DEFAULT false
);

-- 2. Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    status meeting_status NOT NULL DEFAULT 'OPEN'
);

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_slug ON meetings(slug);

-- 3. Meeting Participants Table
CREATE TABLE IF NOT EXISTS meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_required BOOLEAN NOT NULL DEFAULT true
);

-- 4. Availability Slots Table
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES meeting_participants(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL
);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DO $$ BEGIN
    CREATE POLICY "Public profiles read access" ON profiles FOR SELECT USING (true);
    CREATE POLICY "Public profiles insert access" ON profiles FOR INSERT WITH CHECK (true);
    CREATE POLICY "Public profiles update access" ON profiles FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Meetings Policies
DO $$ BEGIN
    CREATE POLICY "Public meetings read access" ON meetings FOR SELECT USING (true);
    CREATE POLICY "Public meetings insert access" ON meetings FOR INSERT WITH CHECK (true);
    CREATE POLICY "Organizer meetings update access" ON meetings FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Meeting Participants Policies
DO $$ BEGIN
    CREATE POLICY "Public meeting_participants read access" ON meeting_participants FOR SELECT USING (true);
    CREATE POLICY "Public meeting_participants insert access" ON meeting_participants FOR INSERT WITH CHECK (true);
    CREATE POLICY "Organizer meeting_participants update access" ON meeting_participants FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Availability Slots Policies
DO $$ BEGIN
    CREATE POLICY "Public availability_slots read access" ON availability_slots FOR SELECT USING (true);
    CREATE POLICY "Public availability_slots insert access" ON availability_slots FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

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

DROP TRIGGER IF EXISTS block_scheduled_updates ON availability_slots;

CREATE TRIGGER block_scheduled_updates
BEFORE INSERT ON availability_slots
FOR EACH ROW
EXECUTE FUNCTION check_meeting_status_before_slot_insert();
