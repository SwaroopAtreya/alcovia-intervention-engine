

-- 1. Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'Normal',
  current_task TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Daily Logs Table
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(50) REFERENCES students(student_id),
  quiz_score INTEGER NOT NULL,
  focus_minutes INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  logged_at TIMESTAMP DEFAULT NOW()
);

-- 3. Interventions Table
CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(50) REFERENCES students(student_id),
  reason TEXT NOT NULL,
  assigned_task TEXT,
  assigned_by VARCHAR(100),
  assigned_at TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample students for testing
INSERT INTO students (student_id, name, status) VALUES
  ('S001', 'Alice Johnson', 'Normal'),
  ('S002', 'Bob Smith', 'Normal'),
  ('S003', 'Charlie Davis', 'Normal');

-- Create indexes for better performance
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_daily_logs_student_id ON daily_logs(student_id);
CREATE INDEX idx_interventions_student_id ON interventions(student_id);
CREATE INDEX idx_interventions_status ON interventions(status);