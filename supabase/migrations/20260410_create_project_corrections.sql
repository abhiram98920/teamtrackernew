CREATE TABLE IF NOT EXISTS project_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    submitter_name TEXT NOT NULL,
    correction_text TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE project_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on project_corrections" ON project_corrections FOR SELECT USING (true);
CREATE POLICY "Allow all insert on project_corrections" ON project_corrections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on project_corrections" ON project_corrections FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on project_corrections" ON project_corrections FOR DELETE USING (true);
