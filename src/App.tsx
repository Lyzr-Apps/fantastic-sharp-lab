import React, { useState, useEffect } from 'react';
import parseLLMJson from './utils/jsonParser';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'hr' | 'employee';
}

interface Module {
  id: string;
  title: string;
  description: string;
  content: string;
  quiz: QuizQuestion[];
  assignedTo: string[];
  createdBy: string;
  createdAt: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer: string;
}

interface Enrollment {
  id: string;
  userId: string;
  moduleId: string;
  progress: number;
  completed: boolean;
  score?: number;
  startedAt: string;
  completedAt?: string;
}

interface AgentResponse {
  response?: {
    content: string;
    type: string;
    confidence: number;
    source_reference: { section: string; context: string };
  };
  metadata?: { processing_time: string; content_scope: boolean };
  assessment?: {
    type: string;
    questions: { question: string; expected_answer: string }[];
    evaluation: {
      score: number;
      feedback: string;
      gaps_identified: { topic: string; recommendation: string }[];
    };
  };
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'auth' | 'hr-dashboard' | 'employee-dashboard'>('auth');
  const [modules, setModules] = useState<Module[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [agentChat, setAgentChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [currentAgentMessage, setCurrentAgentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'quiz' | 'analytics'>('content');

  // Authentication state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '', role: 'employee' as 'hr' | 'employee' });

  // Module creation form
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    content: '',
    quiz: [] as QuizQuestion[]
  });

  const LEARN_AGENT_ID = '68e06493010a31eba989047d';
  const EVAL_AGENT_ID = '68e064a097fff316128efaa2';

  // Load data from localStorage
  useEffect(() => {
    const savedUsers = localStorage.getItem('hr_users');
    const savedModules = localStorage.getItem('hr_modules');
    const savedEnrollments = localStorage.getItem('hr_enrollments');

    if (savedModules) setModules(JSON.parse(savedModules));
    if (savedEnrollments) setEnrollments(JSON.parse(savedEnrollments));
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('hr_modules', JSON.stringify(modules));
  }, [modules]);

  useEffect(() => {
    localStorage.setItem('hr_enrollments', JSON.stringify(enrollments));
  }, [enrollments]);

  const generateRandomId = () => Math.random().toString(36).substr(2, 9);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();

    if (authMode === 'register') {
      const newUser: User = {
        id: generateRandomId(),
        email: authForm.email,
        name: authForm.name,
        role: authForm.role
      };
      setCurrentUser(newUser);
      setView(authForm.role === 'hr' ? 'hr-dashboard' : 'employee-dashboard');
    } else {
      // Mock login
      const mockUser: User = {
        id: generateRandomId(),
        email: authForm.email,
        name: 'Test User',
        role: authForm.email.includes('hr') ? 'hr' : 'employee'
      };
      setCurrentUser(mockUser);
      setView(mockUser.role === 'hr' ? 'hr-dashboard' : 'employee-dashboard');
    }
  };

  const createModule = () => {
    const newModule: Module = {
      id: generateRandomId(),
      title: moduleForm.title,
      description: moduleForm.description,
      content: moduleForm.content,
      quiz: moduleForm.quiz,
      assignedTo: [],
      createdBy: currentUser!.id,
      createdAt: new Date().toISOString()
    };

    setModules([...modules, newModule]);
    setModuleForm({ title: '', description: '', content: '', quiz: [] });
    setShowCreateModule(false);
  };

  const enrollInModule = (moduleId: string) => {
    const newEnrollment: Enrollment = {
      id: generateRandomId(),
      userId: currentUser!.id,
      moduleId,
      progress: 0,
      completed: false,
      startedAt: new Date().toISOString()
    };

    setEnrollments([...enrollments, newEnrollment]);
  };

  const updateProgress = (enrollmentId: string, progress: number) => {
    setEnrollments(prev => prev.map(e =>
      e.id === enrollmentId ? { ...e, progress } : e
    ));
  };

  const callLearnAgent = async (message: string, moduleContent: string) => {
    setIsTyping(true);
    const userId = `user${Date.now()}@test.com`;
    const sessionId = `learn-${LEARN_AGENT_ID}-${Date.now()}`;

    try {
      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: userId,
          agent_id: LEARN_AGENT_ID,
          session_id: sessionId,
          message: `Module content: ${moduleContent}\n\nQuestion: ${message}`
        })
      });

      const data = await response.json();
      const parsedResponse = parseLLMJson(data);

      setAgentChat(prev => [...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: parsedResponse.response?.content || 'No response' }
      ]);
    } catch (error) {
      setAgentChat(prev => [...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' }
      ]);
    }
    setIsTyping(false);
  };

  const callEvalAgent = async (content: string) => {
    setIsTyping(true);
    const userId = `user${Date.now()}@test.com`;
    const sessionId = `eval-${EVAL_AGENT_ID}-${Date.now()}`;

    try {
      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: userId,
          agent_id: EVAL_AGENT_ID,
          session_id: sessionId,
          message: `Generate assessment questions for this content: ${content}`
        })
      });

      const data = await response.json();
      const parsedResponse = parseLLMJson(data);

      setAgentChat(prev => [...prev,
        { role: 'assistant', content: `Generated ${parsedResponse.assessment?.questions?.length || 0} questions. Score: ${parsedResponse.assessment?.evaluation?.score || 'N/A'}` }
      ]);
    } catch (error) {
      setAgentChat(prev => [...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error generating the assessment.' }
      ]);
    }
    setIsTyping(false);
  };

  const AuthView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">HR & Learning Platform</h1>
          <p className="text-gray-600">{authMode === 'login' ? 'Sign in to continue' : 'Create your account'}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          {authMode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={authForm.name}
                onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="John Doe"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="john@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          {authMode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={authForm.role}
                onChange={(e) => setAuthForm({...authForm, role: e.target.value as 'hr' | 'employee'})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="employee">Employee</option>
                <option value="hr">HR Manager</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
          >
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="text-blue-600 hover:text-blue-800 transition duration-200"
          >
            {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );

  const HRDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">HR Manager</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setView('employee-dashboard')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Switch to Employee View
              </button>
              <button
                onClick={() => setCurrentUser(null)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition duration-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Modules Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Training Modules</h2>
                <button
                  onClick={() => setShowCreateModule(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
                >
                  + Create Module
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map(module => (
                  <div key={module.id} className="border rounded-lg p-4 hover:shadow-md transition duration-200">
                    <h3 className="font-semibold text-gray-900 mb-2">{module.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{module.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {module.quiz.length} questions
                      </span>
                      <button
                        onClick={() => {
                          setSelectedModule(module);
                          setActiveTab('content');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analytics */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Analytics Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{modules.length}</div>
                  <div className="text-sm text-gray-600">Total Modules</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {enrollments.filter(e => e.completed).length}
                  </div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {enrollments.filter(e => !e.completed).length}
                  </div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Chat */}
          <div className="bg-white rounded-xl shadow-sm border h-96 flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-orange-600 text-white rounded-t-xl">
              <h3 className="font-semibold">AI Assistant</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {agentChat.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {message.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm">
                    Typing...
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={currentAgentMessage}
                  onChange={(e) => setCurrentAgentMessage(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && currentAgentMessage.trim()) {
                      callLearnAgent(currentAgentMessage, selectedModule?.content || '');
                      setCurrentAgentMessage('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (currentAgentMessage.trim()) {
                      callLearnAgent(currentAgentMessage, selectedModule?.content || '');
                      setCurrentAgentMessage('');
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Module Modal */}
      {showCreateModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Create New Module</h3>
                <button
                  onClick={() => setShowCreateModule(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({...moduleForm, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Module title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({...moduleForm, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Brief description of the module"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  value={moduleForm.content}
                  onChange={(e) => setModuleForm({...moduleForm, content: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows={8}
                  placeholder="Module content in markdown format"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModule(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={createModule}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
              >
                Create Module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const EmployeeDashboard = () => {
    const myEnrollments = enrollments.filter(e => e.userId === currentUser?.id);
    const availableModules = modules.filter(m => !myEnrollments.some(e => e.moduleId === m.id));

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">Learning Dashboard</h1>
                <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-0.5 rounded">Employee</span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setView('hr-dashboard')}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Switch to HR View
                </button>
                <button
                  onClick={() => setCurrentUser(null)}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition duration-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              {/* Available Modules */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Courses</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableModules.map(module => (
                    <div key={module.id} className="border rounded-lg p-4 hover:shadow-md transition duration-200">
                      <h3 className="font-semibold text-gray-900 mb-2">{module.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">{module.description}</p>
                      <button
                        onClick={() => enrollInModule(module.id)}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200"
                      >
                        Enroll Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* My Enrollments */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">My Learning Progress</h2>
                <div className="space-y-4">
                  {myEnrollments.map(enrollment => {
                    const module = modules.find(m => m.id === enrollment.moduleId);
                    if (!module) return null;

                    return (
                      <div key={enrollment.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-gray-900">{module.title}</h3>
                          {enrollment.completed ? (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Completed</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">In Progress</span>
                          )}
                        </div>

                        <div className="mb-3">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{enrollment.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition duration-300"
                              style={{ width: `${enrollment.progress}%` }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedModule(module);
                            setActiveTab('content');
                          }}
                          className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition duration-200"
                        >
                          {enrollment.completed ? 'Review Content' : 'Continue Learning'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI Assistant Chat */}
            <div className="bg-white rounded-xl shadow-sm border h-96 flex flex-col">
              <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-orange-600 text-white rounded-t-xl">
                <h3 className="font-semibold">AI Learning Assistant</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {agentChat.map((message, index) => (
                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm">
                      Typing...
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentAgentMessage}
                    onChange={(e) => setCurrentAgentMessage(e.target.value)}
                    placeholder="Hi! I'm here to help with your learning. Ask me anything..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && currentAgentMessage.trim()) {
                        callLearnAgent(currentAgentMessage, selectedModule?.content || '');
                        setCurrentAgentMessage('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (currentAgentMessage.trim()) {
                        callLearnAgent(currentAgentMessage, selectedModule?.content || '');
                        setCurrentAgentMessage('');
                      }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Module Content Viewer */}
        {selectedModule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-screen overflow-hidden flex flex-col">
              <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-orange-600 text-white rounded-t-xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">{selectedModule.title}</h3>
                  <button
                    onClick={() => setSelectedModule(null)}
                    className="text-white hover:text-gray-200 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('content')}
                  className={`px-4 py-2 font-medium transition duration-200 ${
                    activeTab === 'content'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Content
                </button>
                <button
                  onClick={() => setActiveTab('quiz')}
                  className={`px-4 py-2 font-medium transition duration-200 ${
                    activeTab === 'quiz'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Quiz
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 font-medium transition duration-200 ${
                    activeTab === 'analytics'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClickCapture={() => callEvalAgent(selectedModule.content)}
                >
                  AI Assessment
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'content' && (
                  <div className="prose max-w-none">
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-gray-700">{selectedModule.description}</p>
                    </div>
                    <div className="whitespace-pre-wrap text-gray-800">
                      {selectedModule.content}
                    </div>
                  </div>
                )}

                {activeTab === 'quiz' && (
                  <div className="space-y-4">
                    {selectedModule.quiz.length > 0 ? (
                      selectedModule.quiz.map((question, index) => (
                        <div key={question.id} className="border rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-3">
                            Q{index + 1}: {question.question}
                          </h4>
                          {question.options && (
                            <div className="space-y-2">
                              {question.options.map((option, optIndex) => (
                                <label key={optIndex} className="flex items-center space-x-3 cursor-pointer">
                                  <input type="radio" name={`question-${question.id}`} className="text-blue-600" />
                                  <span className="text-gray-700">{option}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {!question.options && (
                            <input
                              type="text"
                              className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Your answer"
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-600">No quiz questions available yet.</p>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        callEvalAgent(selectedModule.content);
                        setActiveTab('analytics');
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
                    >
                      Get AI-Generated Assessment
                    </button>
                  </div>
                )}

                {activeTab === 'analytics' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">AI Assessment Ready</h4>
                      <p className="text-blue-800 mb-4">
                        Click the button below to generate personalized questions based on this content.
                      </p>
                      <button
                        onClick={() => callEvalAgent(selectedModule.content)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
                      >
                        Generate Assessment Questions
                      </button>
                    </div>
                    <div className="text-center py-8">
                      <p className="text-gray-600">Assessment features powered by AI EvalAgent</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedModule(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition duration-200"
                  >
                    Close
                  </button>
                  {!enrollments.some(e => e.moduleId === selectedModule.id && e.userId === currentUser?.id) && (
                    <button
                      onClick={() => {
                        enrollInModule(selectedModule.id);
                        setSelectedModule(null);
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
                    >
                      Enroll in Module
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (view === 'auth') return <AuthView />;
  if (view === 'hr-dashboard') return <HRDashboard />;
  return <EmployeeDashboard />;
}

export default App;
