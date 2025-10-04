import React, { useState, useEffect } from 'react';
import parseLLMJson from './utils/jsonParser';

interface Course {
  id: string;
  title: string;
  description: string;
  type: 'text' | 'files' | 'links';
  content: string;
  lessons: Lesson[];
  status: 'draft' | 'published' | 'archived';
}

interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'file' | 'link';
  assessment?: Assessment;
}

interface Assessment {
  id: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'open-ended';
  options?: string[];
  correctAnswer?: string;
}

interface Assignment {
  id: string;
  courseId: string;
  userId: string;
  assignedAt: string;
  completedAt?: string;
  progress: number;
  status: 'assigned' | 'in-progress' | 'completed' | 'overdue';
}

interface AgentResponse {
  result: {
    response?: string;
    key_points?: string[];
    suggested_followup?: string[];
    score?: number;
    question_feedback?: any[];
    summary?: string;
  };
  confidence: number;
  metadata: any;
}

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<'hr' | 'employee'>('hr');
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [activeTab, setActiveTab] = useState<'courses' | 'assignments' | 'reports'>('courses');
  const [showEditor, setShowEditor] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isAssessmentMode, setIsAssessmentMode] = useState(false);
  const [assessmentAnswers, setAssessmentAnswers] = useState<{[key: string]: string}>({});
  const [sessionId, setSessionId] = useState('');

  // Generate session ID on mount
  useEffect(() => {
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // API Call Function for Agents
  const callAgent = async (agentId: string, message: string): Promise<AgentResponse | null> => {
    try {
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: userId,
          agent_id: agentId,
          session_id: sessionId,
          message: message
        })
      });

      const data = await response.text();
      const parsed = parseLLMJson(data);
      return parsed;
    } catch (error) {
      console.error('Agent API Error:', error);
      return null;
    }
  };

  // Learning Assistant (LearnAgent: 68e0e0af615699d53b623bae)
  const handleLearningQuestion = async (question: string) => {
    if (!currentLesson) return;

    setIsChatLoading(true);
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);

    const response = await callAgent(
      '68e0e0af615699d53b623bae',
      `Lesson: "${currentLesson.title}"\nContent: ${currentLesson.content}\n\nQuestion: ${question}`);

    if (response) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: response.result.response || 'I could not process your question at the moment.',
        key_points: response.result.key_points,
        suggested_followup: response.result.suggested_followup
      }]);
    }

    setIsChatLoading(false);
  };

  // Evaluation Assistant (EvalAgent: 68e0e0bc615699d53e623bae)
  const evaluateAssessment = async (courseId: string, lessonId: string, answers: {[key: string]: string}) => {
    setIsChatLoading(true);

    const course = courses.find(c => c.id === courseId);
    const lesson = course?.lessons.find(l => l.id === lessonId);
    if (!lesson || !lesson.assessment) return null;

    const answerText = Object.entries(answers).map(([qid, ans]) =>
      `Question ${qid}: ${lesson.assessment.questions.find(q => q.id === qid)?.text}\nAnswer: ${ans}`
    ).join('\n\n');

    const response = await callAgent(
      '68e0e0bc615699d53e623bae',
      `Assessment for lesson "${lesson.title}" in course "${course?.title}"\n\nAnswers:\n${answerText}`);

    if (response) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: response.result.summary || `Assessment completed! Score: ${response.result.score}/100`,
        score: response.result.score,
        feedback: response.result.question_feedback
      }]);
    }

    setIsChatLoading(false);
    return response;
  };

  // Sample Data
  useEffect(() => {
    const sampleCourses: Course[] = [
      {
        id: '1',
        title: 'Workplace Safety',
        description: 'Essential safety protocols for office environment',
        type: 'text',
        content: 'Learn the fundamentals of workplace safety...',
        status: 'published',
        lessons: [
          {
            id: '1-1',
            title: 'Fire Safety',
            content: 'Fire safety is crucial in any workplace. Always maintain clear evacuation routes, keep fire extinguishers accessible, and conduct regular fire drills. Employees should be trained on proper evacuation procedures and assembly points.',
            type: 'text',
            assessment: {
              id: 'assess-1',
              questions: [
                {
                  id: 'q1',
                  text: 'What is the first step in case of fire?',
                  type: 'multiple-choice',
                  options: ['Evacuate immediately', 'Call fire department', 'Identify exit routes'],
                  correctAnswer: 'Identify exit routes'
                },
                {
                  id: 'q2',
                  text: 'How often should fire drills be conducted?',
                  type: 'open-ended'
                }
              ]
            }
          },
          {
            id: '1-2',
            title: 'Electrical Safety',
            content: 'Proper electrical safety prevents accidents. Always check cords for damage, avoid overloading circuits, and report any electrical hazards immediately. Never attempt electrical repairs unless qualified.',
            type: 'text'
          }
        ]
      },
      {
        id: '2',
        title: 'Customer Service Excellence',
        description: 'Build exceptional customer service skills',
        type: 'text',
        content: 'Master the art of customer interaction...',
        status: 'published',
        lessons: [
          {
            id: '2-1',
            title: 'Communication Basics',
            content: 'Effective communication is the foundation of great customer service. Listen actively, speak clearly, and maintain professional tone. Always confirm understanding by briefly restating customer concerns.',
            type: 'text'
          }
        ]
      }
    ];

    const sampleAssignments: Assignment[] = [
      {
        id: '1',
        courseId: '1',
        userId: 'employee-1',
        assignedAt: new Date().toISOString(),
        progress: 80,
        status: 'in-progress'
      },
      {
        id: '2',
        courseId: '2',
        userId: 'employee-1',
        assignedAt: new Date().toISOString(),
        progress: 0,
        status: 'assigned'
      }
    ];

    setCourses(sampleCourses);
    setAssignments(sampleAssignments);
  }, []);

  // UI Components
  const Sidebar = () => (
    <div className="w-64 bg-surface shadow-lg h-screen p-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-primary mb-2">HR L&D Platform</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentRole('hr')}
            className={`px-3 py-1 rounded text-sm ${currentRole === 'hr' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            HR Manager
          </button>
          <button
            onClick={() => setCurrentRole('employee')}
            className={`px-3 py-1 rounded text-sm ${currentRole === 'employee' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            Employee
          </button>
        </div>
      </div>

      {currentRole === 'hr' ? (
        <nav className="space-y-2">
          <button
            onClick={() => setActiveTab('courses')}
            className={`w-full text-left p-3 rounded ${activeTab === 'courses' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Courses
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`w-full text-left p-3 rounded ${activeTab === 'assignments' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Assignments
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full text-left p-3 rounded ${activeTab === 'reports' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Reports
          </button>
        </nav>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-700 mb-4">My Learning</h3>
          <div className="space-y-2">
            {assignments.map(assignment => {
              const course = courses.find(c => c.id === assignment.courseId);
              return (
                <div key={assignment.id} className="p-2 bg-gray-50 rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{course?.title}</span>
                    <span className="text-xs text-success">{assignment.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-success h-2 rounded-full" style={{width: `${assignment.progress}%`}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const CourseEditor = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text">Create New Course</h2>
          <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input className="w-full p-3 border rounded-lg" placeholder="Course title..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea className="w-full p-3 border rounded-lg h-20" placeholder="Course description..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select className="w-full p-3 border rounded-lg">
              <option value="text">Text Content</option>
              <option value="files">File Upload</option>
              <option value="links">External Links</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={() => setShowEditor(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600">
            Create Course
          </button>
        </div>
      </div>
    </div>
  );

  const ChatInterface = () => (
    <div className="w-80 bg-surface border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-text">Learning Assistant</h3>
        <p className="text-xs text-gray-500">Ask questions about current lesson</p>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {chatMessages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text'
            }`}>
              {message.content}
            </div>
          </div>
        ))}

        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-text p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 p-2 border rounded-lg text-sm"
            onKeyPress={(e) => e.key === 'Enter' && handleLearningQuestion(chatInput)}
          />
          <button
            onClick={() => {
              if (chatInput.trim()) {
                handleLearningQuestion(chatInput);
                setChatInput('');
              }
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );

  const AssessmentView = () => {
    if (!currentLesson?.assessment) return null;

    return (
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-text">Lesson Assessment</h3>
        {currentLesson.assessment.questions.map((question, qIndex) => (
          <div key={question.id} className="mb-6">
            <p className="font-medium mb-3 text-text">
              {qIndex + 1}. {question.text}
            </p>

            {question.type === 'multiple-choice' && question.options && (
              <div className="space-y-2">
                {question.options.map((option, oIndex) => (
                  <label key={oIndex} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      onChange={(e) => setAssessmentAnswers(prev => ({...prev, [question.id]: e.target.value}))}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-text">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'open-ended' && (
              <textarea
                value={assessmentAnswers[question.id] || ''}
                onChange={(e) => setAssessmentAnswers(prev => ({...prev, [question.id]: e.target.value}))}
                className="w-full p-3 border rounded-lg h-24"
                placeholder="Type your answer here..."
              />
            )}
          </div>
        ))}

        <div className="flex justify-end space-x-3">
          <button onClick={() => setIsAssessmentMode(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={async () => {
              if (currentCourse && currentLesson) {
                await evaluateAssessment(currentCourse.id, currentLesson.id, assessmentAnswers);
                setIsAssessmentMode(false);
              }
            }}
            className="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-600"
          >
            Submit Assessment
          </button>
        </div>
      </div>
    );
  };

  // Main Content Rendering
  const renderContent = () => {
    if (currentRole === 'hr') {
      return (
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-text mb-2">Course Management</h2>
            <p className="text-gray-600">Create, manage, and assign courses to employees.</p>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowEditor(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              + Create New Course
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <div key={course.id} className="bg-surface rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-text mb-2">{course.title}</h3>
                <p className="text-gray-600 mb-4">{course.description}</p>
                <div className="flex justify-between items-center">
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    course.status === 'published' ? 'bg-success text-white' : 'bg-warning text-white'
                  }`}>
                    {course.status}
                  </span>
                  <div className="space-x-2">
                    <button className="text-primary hover:underline text-sm">Edit</button>
                    <button className="text-secondary hover:underline text-sm">Assign</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex">
        <div className="flex-1 p-6">
          {currentCourse && currentLesson && !isAssessmentMode ? (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-text mb-2">{currentLesson.title}</h2>
                <p className="text-gray-600">{currentCourse.title}</p>
              </div>

              <div className="bg-surface rounded-lg p-6 mb-6">
                <div className="prose max-w-none text-text">
                  {currentLesson.content}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      handleLearningQuestion(`Can you provide a summary of this lesson titled "${currentLesson.title}"?`);
                    }}
                    className="px-4 py-2 bg-info text-white rounded-lg hover:bg-blue-600"
                  >
                    Summary
                  </button>
                  {currentLesson.assessment && (
                    <button
                      onClick={() => setIsAssessmentMode(true)}
                      className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-green-600"
                    >
                      Take Assessment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : isAssessmentMode && currentLesson?.assessment ? (
            <AssessmentView />
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-text mb-6">My Learning Dashboard</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignments.slice(0, 6).map(assignment => {
                  const course = courses.find(c => c.id === assignment.courseId);
                  return (
                    <div key={assignment.id} className="bg-surface rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-semibold text-text mb-2">{course?.title}</h3>
                      <p className="text-gray-600 mb-4">{course?.description}</p>

                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">Progress</span>
                          <span className="text-sm font-medium text-text">{assignment.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              assignment.progress > 80 ? 'bg-success' :
                              assignment.progress > 50 ? 'bg-warning' : 'bg-error'
                            }`}
                            style={{width: `${assignment.progress}%`}}
                          ></div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setCurrentCourse(course || null);
                          if (course?.lessons.length) {
                            setCurrentLesson(course.lessons[0]);
                          }
                        }}
                        className="w-full bg-primary text-white py-2 rounded hover:bg-blue-600"
                      >
                        Continue Learning
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {currentRole === 'employee' && <ChatInterface />}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      {renderContent()}
      {showEditor && <CourseEditor />}
    </div>
  );
};

export default App;