// App.js - Alcovia Student Focus App
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

// Backend API URL - will be replaced with actual URL during deployment
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function App() {
  // State Management
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Focus Timer State
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Quiz State
  const [quizScore, setQuizScore] = useState('');

  // Polling for status updates
  const pollingRef = useRef(null);

  // Load students on mount
  useEffect(() => {
    fetchStudents();
  }, []);

  // Poll for updates when student is locked
  useEffect(() => {
    if (selectedStudent) {
      fetchStudentStatus();
      
      // Start polling every 5 seconds when student is in "Needs Intervention" state
      if (studentData?.student?.status === 'Needs Intervention') {
        pollingRef.current = setInterval(fetchStudentStatus, 5000);
      } else {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedStudent, studentData?.student?.status]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Fetch all students for dropdown
  const fetchStudents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/students`);
      const data = await response.json();
      if (data.success) {
        setStudents(data.students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      Alert.alert('Error', 'Failed to load students. Check backend connection.');
    }
  };

  // Fetch current student status
  const fetchStudentStatus = async () => {
    if (!selectedStudent) return;
    try {
      const response = await fetch(`${API_URL}/api/student/${selectedStudent}`);
      const data = await response.json();
      if (data.success) {
        setStudentData(data);
      }
    } catch (error) {
      console.error('Error fetching student status:', error);
    }
  };

  // Focus Timer Functions
  const startFocusTimer = () => {
    setIsTimerRunning(true);
    timerRef.current = setInterval(() => {
      setFocusMinutes((prev) => prev + 1);
    }, 60000); // Increment every minute (60000ms)
  };

  const stopFocusTimer = () => {
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Submit daily check-in
  const submitDailyCheckin = async () => {
    if (!quizScore || quizScore === '') {
      Alert.alert('Error', 'Please enter your quiz score');
      return;
    }

    const score = parseInt(quizScore);
    if (isNaN(score) || score < 0 || score > 10) {
      Alert.alert('Error', 'Quiz score must be between 0 and 10');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/daily-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent,
          quiz_score: score,
          focus_minutes: focusMinutes,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Submitted', data.message);
        
        // Reset form
        setFocusMinutes(0);
        setQuizScore('');
        stopFocusTimer();
        
        // Refresh student status
        await fetchStudentStatus();
      } else {
        Alert.alert('Error', data.error || 'Submission failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit check-in. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Complete remedial task
  const completeTask = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedStudent }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', data.message);
        await fetchStudentStatus();
      } else {
        Alert.alert('Error', data.error || 'Failed to complete task');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to complete task. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // RENDER FUNCTIONS FOR DIFFERENT VIEWS

  // Student Selector Screen
  const renderStudentSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.title}>🎓 Alcovia Focus Mode</Text>
      <Text style={styles.subtitle}>Select Your Student ID</Text>
      
      {students.length === 0 ? (
        <ActivityIndicator size="large" color="#4A90E2" style={{ marginTop: 20 }} />
      ) : (
        students.map((student) => (
          <TouchableOpacity
            key={student.student_id}
            style={styles.studentButton}
            onPress={() => setSelectedStudent(student.student_id)}
          >
            <Text style={styles.studentButtonText}>
              {student.student_id} - {student.name}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  // Normal State - Focus Timer + Quiz
  const renderNormalState = () => (
    <View style={styles.mainContainer}>
      <Text style={styles.welcomeText}>
        Welcome, {studentData?.student?.name}! 👋
      </Text>
      <Text style={styles.statusBadge}>✅ Status: Normal</Text>

      {/* Focus Timer Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏱️ Focus Timer</Text>
        <Text style={styles.timerDisplay}>{focusMinutes} minutes</Text>
        {!isTimerRunning ? (
          <TouchableOpacity style={styles.primaryButton} onPress={startFocusTimer}>
            <Text style={styles.buttonText}>Start Focus Timer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, styles.stopButton]}
            onPress={stopFocusTimer}
          >
            <Text style={styles.buttonText}>Stop Timer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Daily Quiz Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Daily Quiz Score</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter score (0-10)"
          keyboardType="numeric"
          value={quizScore}
          onChangeText={setQuizScore}
          maxLength={2}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={submitDailyCheckin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Daily Check-in</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // Locked State - Waiting for Mentor
  const renderLockedState = () => (
    <View style={styles.lockedContainer}>
      <Text style={styles.lockedEmoji}>🔒</Text>
      <Text style={styles.lockedTitle}>Account Locked</Text>
      <Text style={styles.lockedMessage}>
        Analysis in progress. Waiting for Mentor...
      </Text>
      <ActivityIndicator size="large" color="#FF6B6B" style={{ marginTop: 20 }} />
      <Text style={styles.lockedSubtext}>
        Your performance needs attention. A mentor is reviewing your progress.
      </Text>
      <Text style={styles.lockedSubtext} style={{ marginTop: 10, fontSize: 12 }}>
        (Checking for updates every 5 seconds...)
      </Text>
    </View>
  );

  // Remedial State - Task Assignment
  const renderRemedialState = () => (
    <View style={styles.remedialContainer}>
      <Text style={styles.remedialTitle}>📚 Remedial Task Assigned</Text>
      <Text style={styles.statusBadge}>⚠️ Status: Remedial</Text>

      <View style={styles.taskBox}>
        <Text style={styles.taskLabel}>Your Task:</Text>
        <Text style={styles.taskText}>{studentData?.student?.current_task}</Text>
      </View>

      <TouchableOpacity
        style={styles.completeButton}
        onPress={completeTask}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>✓ Mark as Complete</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.remedialNote}>
        Complete this task to return to normal mode.
      </Text>
    </View>
  );

  // Main Content Router
  const renderContent = () => {
    if (!selectedStudent) {
      return renderStudentSelector();
    }

    if (!studentData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={{ marginTop: 20, color: '#7F8C8D' }}>Loading student data...</Text>
        </View>
      );
    }

    const status = studentData.student.status;

    // Route to correct state UI
    if (status === 'Normal') {
      return renderNormalState();
    } else if (status === 'Needs Intervention') {
      return renderLockedState();
    } else if (status === 'Remedial') {
      return renderRemedialState();
    }

    // Fallback
    return (
      <View style={styles.loadingContainer}>
        <Text>Unknown status: {status}</Text>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {renderContent()}
      
      {/* Back Button */}
      {selectedStudent && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedStudent(null);
            setStudentData(null);
            setFocusMinutes(0);
            setQuizScore('');
            stopFocusTimer();
          }}
        >
          <Text style={styles.backButtonText}>← Change Student</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
    minHeight: '100vh',
  },
  selectorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#7F8C8D',
    marginBottom: 30,
  },
  studentButton: {
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 10,
    marginVertical: 8,
    width: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  studentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  mainContainer: {
    flex: 1,
    padding: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  statusBadge: {
    fontSize: 16,
    color: '#27AE60',
    fontWeight: '600',
    marginBottom: 30,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 15,
  },
  timerDisplay: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4A90E2',
    textAlign: 'center',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#E74C3C',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#27AE60',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 500,
  },
  lockedEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 10,
  },
  lockedMessage: {
    fontSize: 18,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 10,
  },
  lockedSubtext: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 40,
  },
  remedialContainer: {
    flex: 1,
    padding: 20,
  },
  remedialTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  taskBox: {
    backgroundColor: '#FFF3CD',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  taskLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 10,
  },
  taskText: {
    fontSize: 18,
    color: '#2C3E50',
    lineHeight: 24,
  },
  completeButton: {
    backgroundColor: '#27AE60',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  remedialNote: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 15,
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '500',
  },
});