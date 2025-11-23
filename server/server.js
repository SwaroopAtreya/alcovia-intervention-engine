// server.js - Alcovia Intervention Engine Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// n8n Webhook URL
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Alcovia Intervention Engine Running',
    timestamp: new Date().toISOString()
  });
});

// Get all students (for dropdown)
app.get('/api/students', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('student_id');

    if (error) throw error;
    res.json({ success: true, students: data });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get student status
app.get('/api/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .single();

    if (error) throw error;

    // Get pending intervention if exists
    const { data: intervention } = await supabase
      .from('interventions')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      success: true,
      student: data,
      intervention: intervention || null
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /daily-checkin - Main logic endpoint
app.post('/api/daily-checkin', async (req, res) => {
  try {
    const { student_id, quiz_score, focus_minutes } = req.body;

    // Validation
    if (!student_id || quiz_score === undefined || focus_minutes === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: student_id, quiz_score, focus_minutes'
      });
    }

    // THE LOGIC GATE (EXACT AS SPECIFIED)
    const isSuccess = quiz_score > 7 && focus_minutes > 60;
    const status = isSuccess ? 'On Track' : 'Needs Intervention';

    // Log the daily check-in
    const { error: logError } = await supabase
      .from('daily_logs')
      .insert({
        student_id,
        quiz_score,
        focus_minutes,
        status
      });

    if (logError) throw logError;

    if (isSuccess) {
      // SUCCESS PATH
      await supabase
        .from('students')
        .update({
          status: 'Normal',
          current_task: null,
          updated_at: new Date().toISOString()
        })
        .eq('student_id', student_id);

      return res.json({
        success: true,
        status: 'On Track',
        message: 'Great job! Keep up the good work.'
      });
    } else {
      // FAILURE PATH - THE LOCK
      // 1. Update student status to "Needs Intervention"
      await supabase
        .from('students')
        .update({
          status: 'Needs Intervention',
          updated_at: new Date().toISOString()
        })
        .eq('student_id', student_id);

      // 2. Get student info
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('student_id', student_id)
        .single();

      // 3. Create intervention record
      const { data: intervention, error: intError } = await supabase
        .from('interventions')
        .insert({
          student_id,
          reason: `Low performance: Quiz ${quiz_score}/10, Focus ${focus_minutes} mins`,
          status: 'Pending'
        })
        .select()
        .single();

      if (intError) throw intError;

      // 4. Trigger n8n webhook
      if (N8N_WEBHOOK_URL) {
        try {
          await axios.post(N8N_WEBHOOK_URL, {
            student_id,
            student_name: student.name,
            quiz_score,
            focus_minutes,
            intervention_id: intervention.id,
            reason: `Quiz Score: ${quiz_score}/10, Focus Time: ${focus_minutes} mins`
          });
          console.log('✅ n8n webhook triggered successfully');
        } catch (webhookError) {
          console.error('❌ Error triggering n8n webhook:', webhookError.message);
        }
      } else {
        console.warn('⚠️ N8N_WEBHOOK_URL not configured');
      }

      return res.json({
        success: true,
        status: 'Pending Mentor Review',
        message: 'Your performance needs attention. A mentor will review shortly.'
      });
    }
  } catch (error) {
    console.error('Error in daily-checkin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /assign-intervention - Called by n8n after mentor approval
app.post('/api/assign-intervention', async (req, res) => {
  try {
    const { student_id, task, intervention_id } = req.body;

    if (!student_id || !task) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: student_id, task'
      });
    }

    // Update intervention record
    if (intervention_id) {
      await supabase
        .from('interventions')
        .update({
          assigned_task: task,
          assigned_by: 'Mentor',
          assigned_at: new Date().toISOString(),
          status: 'Assigned'
        })
        .eq('id', intervention_id);
    }

    // Update student status to Remedial and assign task
    await supabase
      .from('students')
      .update({
        status: 'Remedial',
        current_task: task,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', student_id);

    console.log(`Intervention assigned to ${student_id}: ${task}`);

    res.json({
      success: true,
      message: 'Intervention assigned successfully',
      task
    });
  } catch (error) {
    console.error('Error assigning intervention:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /complete-task - Student marks remedial task as complete
app.post('/api/complete-task', async (req, res) => {
  try {
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing student_id'
      });
    }

    // Mark intervention as completed
    await supabase
      .from('interventions')
      .update({
        completed_at: new Date().toISOString(),
        status: 'Completed'
      })
      .eq('student_id', student_id)
      .eq('status', 'Assigned');

    // Return student to Normal state
    await supabase
      .from('students')
      .update({
        status: 'Normal',
        current_task: null,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', student_id);

    console.log(`Task completed by ${student_id}`);

    res.json({
      success: true,
      message: 'Task completed! You are back to normal mode.'
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Alcovia Backend running on port ${PORT}`);
  console.log(`Supabase connected: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`n8n webhook: ${N8N_WEBHOOK_URL ? '✅' : '❌ Not configured'}`);
});