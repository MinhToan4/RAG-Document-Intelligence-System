import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { AnswerContent } from './components/AnswerContent';
import { useAuth } from './hooks/useAuth';
import { useDocuments } from './hooks/useDocuments';
import { useQuery } from './hooks/useQuery';
import { useHistory, type QueryLog } from './hooks/useHistory';
import { normalizeMojibakeText } from './lib/text';

type Tab = 'Workspace' | 'Document Library' | 'System Info' | 'Profile';

function statusClass(status: 'ready' | 'processing' | 'failed'): string {
  if (status === 'ready') return 'status-ready';
  if (status === 'processing') return 'status-processing';
  return 'status-failed';
}

function statusLabel(status: 'ready' | 'processing' | 'failed'): string {
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Processing';
  return 'Failed';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function App() {
  const {
    user,
    loading: authLoading,
    error: authError,
    loginWithPassword,
    registerWithPassword,
    updateProfileInfo,
    logout,
  } = useAuth();
  const { documents, loading, error, upload, remove } = useDocuments(Boolean(user));
  const { messages, loading: querying, error: queryError, submit, clearSession, restoreSession } = useQuery();
  const { history, fetchHistory, loading: historyLoading, error: historyError, deleteHistoryItem } = useHistory();

  const [activeTab, setActiveTab] = useState<Tab>('Workspace');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [topK, setTopK] = useState<number | ''>(5);
  const [showHistory, setShowHistory] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '', password: '', confirmPassword: '' });

  useEffect(() => {
    if (user) {
      setProfileForm({ fullName: user.fullName || '', password: '', confirmPassword: '' });
    }
  }, [user]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toastState, setToastState] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const combinedError = authError ?? error ?? queryError ?? historyError;
  const readyDocs = useMemo(() => documents.filter((doc) => doc.status === 'ready').length, [documents]);
  const hasAnswer = messages.length > 0;

  const sourceFiles = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.sources) {
      for (const source of lastMsg.sources) {
        const name = normalizeMojibakeText(source.documentName);
        if (!seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
    }
    return names;
  }, [messages]);

  const resizeComposerInput = () => {
    const input = composerInputRef.current;
    if (!input) {
      return;
    }
    input.style.height = 'auto';
    const computed = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 24;
    const maxHeight = lineHeight * 5;
    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!searchQuery.trim() || querying) {
      return;
    }
    const question = searchQuery.trim();

    if (topK === '') {
      showToastNotification('Error: Top K value is invalid (Must be between 1 and 20)', 'error');
      return;
    }
    const finalTopK = Number(topK);
    if (finalTopK <= 0 || finalTopK > 20) {
      showToastNotification('Error: Top K value is invalid (Must be between 1 and 20)');
      return;
    }

    try {
      await submit({
        question,
        documentIds: selectedIds.length > 0 ? selectedIds : undefined,
        topK: finalTopK,
      });
    } finally {
      setSearchQuery('');
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (searchQuery.trim() && !querying) {
        composerFormRef.current?.requestSubmit();
      }
    }
  };

  const onAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (authLoading) {
      return;
    }

    if (authMode === 'register' && authForm.password !== authForm.confirmPassword) {
      showToastNotification('Passwords do not match.');
      return;
    }

    if (authMode === 'login') {
      await loginWithPassword({
        username: authForm.username.trim(),
        password: authForm.password,
      });
    } else {
      await registerWithPassword({
        username: authForm.username.trim(),
        email: authForm.email.trim(),
        password: authForm.password,
        fullName: authForm.fullName.trim() || undefined,
      });
    }

    setAuthForm({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setActiveTab('Workspace');
  };

  const onProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (authLoading) return;
    
    if (profileForm.password !== profileForm.confirmPassword) {
      showToastNotification('Passwords do not match.', 'error');
      return;
    }

    try {
      await updateProfileInfo({ 
        fullName: profileForm.fullName.trim(),
        password: profileForm.password || undefined
      });
      showToastNotification('Profile updated successfully.', 'success');
      setProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch {
      // Handled by hook errors
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const clearUpload = () => {
    setPendingFile(null);
    setDisplayName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const confirmUpload = async () => {
    if (!pendingFile || loading) {
      return;
    }
    await upload(pendingFile, displayName.trim() || undefined);
    clearUpload();
  };

  const toggleSelectedDocument = (id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const showToastNotification = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToastState({ text: message, type });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastState(null);
      toastTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    if (combinedError) {
      showToastNotification(combinedError, 'error');
    }
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [combinedError, showToastNotification]);

  const closeToast = () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastState(null);
  };

  const startNewSession = () => {
    closeToast();
    setSearchQuery('');
    setShowSources(false);
    clearSession();
  };

  const historyEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowSources(false);
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) {
      setSelectedIds([]);
      setSearchQuery('');
      setShowSources(false);
      setShowHistory(false);
      clearSession();
    }
  }, [clearSession, user]);

  useEffect(() => {
    resizeComposerInput();
  }, [searchQuery]);

  const openHistory = () => {
    setShowHistory(true);
    void fetchHistory();
  };

  const closeHistory = () => {
    setShowHistory(false);
  };

  const handleRestoreHistory = (item: QueryLog) => {
    // If the database has answer stored (from newly modified DB), restore it
    if (item.answer) {
      restoreSession([
        { id: crypto.randomUUID(), role: 'user', content: item.question },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: item.answer,
          sources: item.sources || [],
          model: item.modelName
        }
      ]);
      setTopK(item.topK);
      setShowHistory(false);
    } else {
      showToastNotification('This history entry was saved before full conversational logs were supported, so its answer cannot be restored.');
    }
  };

  return (
    <div className="app">
      {showHistory && (
        <div className="history-modal-backdrop" onClick={closeHistory}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h2>Query History</h2>
              <button className="history-close-btn" onClick={closeHistory}>&times;</button>
            </div>
            <div className="history-body">
              {historyLoading ? (
                <p>Loading history...</p>
              ) : history.length === 0 ? (
                <p>No history found.</p>
              ) : (
                <div className="history-list">
                  {history.map((item: QueryLog) => (
                    <div
                      key={item.id}
                      className={`history-item ${item.answer ? 'restorable' : ''}`}
                      onClick={() => handleRestoreHistory(item)}
                      title={item.answer ? "Click to restore this chat" : "No answer data found in this log"}
                    >
                      <div className="history-item-header">
                        <p className="history-question" title={item.question}>{item.question}</p>
                        <button 
                          className="history-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item.id).catch((err: Error) => showToastNotification(err.message));
                          }}
                          title="Delete this query"
                        >&times;</button>
                      </div>
                      <div className="history-meta">
                        <span className="history-meta-item">Model: {item.modelName}</span>
                        <span className="history-meta-item">Top K: {item.topK}</span>
                        <span className="history-meta-item">Retrieved: {item.retrievedCount}</span>
                        <span className="history-meta-item">Date: {formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden-file-input"
        onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)}
      />

      <header className="top-nav">
        {user ? (
          <>
            {(['Workspace', 'Document Library', 'System Info'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              >
                {tab}
              </button>
            ))}
            <div className="auth-badge-wrap">
              <span 
                className="auth-user-label actionable" 
                onClick={() => setActiveTab('Profile')} 
                title="Go to Profile"
              >
                Hi, {user.fullName || user.username}
              </span>
              <button type="button" className="outline-btn auth-logout-btn" onClick={logout}>
                Logout
              </button>
            </div>
          </>
        ) : (
          <div className="auth-header-title">RAG Document Intelligence System</div>
        )}
      </header>

      <main className="main">
        {toastState && (
          <div className={`error-toast ${toastState.type === 'success' ? 'success' : ''}`} role="alert" aria-live="polite">
            <span className="error-toast-text">{toastState.text}</span>
            <button type="button" className="error-toast-close" onClick={closeToast} aria-label="Close error">
              x
            </button>
          </div>
        )}

        {user ? (
          <>
            {activeTab === 'Workspace' && (
              <section className={`workspace-view ${hasAnswer ? '' : 'no-answer-layout'}`.trim()}>
                <button
                  type="button"
                  className="composer-secondary-btn new-chat-floating"
                  onClick={startNewSession}
                  disabled={querying}
                >
                  New chat
                </button>
                <button
                  type="button"
                  className="composer-secondary-btn history-floating"
                  onClick={openHistory}
                  disabled={querying}
                >
                  History
                </button>

                <div className={`panel response-panel ${hasAnswer ? 'has-answer' : 'no-answer'} ${showSources ? 'sources-open' : ''}`}>
                  <div className="response-body">
                    {hasAnswer ? (
                      <div className="chat-history">
                        {messages.map((message) => (
                          <div key={message.id} className={`chat-message ${message.role}`}>
                            {message.role === 'user' ? (
                              <div className="user-message">
                                <strong>You</strong>
                                <p>{message.content}</p>
                              </div>
                            ) : (
                              <div className="assistant-message">
                                <strong>Assistant</strong>
                                <AnswerContent answer={message.content} />
                                {message.model && <small className="muted-text">Model: {message.model}</small>}
                              </div>
                            )}
                          </div>
                        ))}
                        <div ref={historyEndRef} />
                      </div>
                    ) : (
                      <div className="placeholder-content">
                        <h1 className="placeholder-title">RAG Document Intelligence System</h1>
                        <p className="placeholder-description">
                          Ask a question about your uploaded files. The system retrieves relevant chunks and returns
                          grounded answers with clear citations from available data.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="composer-dock">
                  <div className="sources-toggle-wrap">
                    <label className="top-k-label">
                      Top K:
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={topK}
                        onChange={(e) => setTopK(e.target.value === '' ? '' : Number(e.target.value))}
                        className="top-k-input"
                        disabled={querying}
                      />
                    </label>
                    {hasAnswer && (
                      <button
                        type="button"
                        className="sources-toggle-btn"
                        onClick={() => setShowSources((prev) => !prev)}
                        aria-expanded={showSources}
                      >
                        {showSources ? 'Hide sources' : 'Show sources'}
                      </button>
                    )}
                  </div>

                  {hasAnswer && showSources && (
                    <div className="sources-block">
                      <div className="source-chips">
                        {sourceFiles.length === 0 ? (
                          <span className="muted-text">No sources yet.</span>
                        ) : (
                          sourceFiles.map((name) => (
                            <span key={name} className="source-chip">
                              {name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <form ref={composerFormRef} onSubmit={onSearch} className="gemini-composer">
                    <span className="composer-icon" aria-hidden="true">
                      ⌕
                    </span>
                    <textarea
                      ref={composerInputRef}
                      rows={1}
                      className="composer-input"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={onComposerKeyDown}
                      placeholder="Ask anything..."
                      disabled={querying}
                    />
                    <div className="composer-actions">
                      {selectedIds.length > 0 && (
                        <span className="scope-chip">{selectedIds.length} docs</span>
                      )}
                      <button type="submit" className="solid-btn" disabled={!searchQuery.trim() || querying}>
                        {querying ? '...' : 'Send'}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}

            {activeTab === 'Document Library' && (
              <section className="library-view">
                <div className="panel library-top">
                  <div className="library-top-left">
                    <h2>Document Repository</h2>
                    <p>
                      Ready: {readyDocs}/{documents.length}
                    </p>
                  </div>

                  <div className="library-top-actions">
                    <button className="outline-btn" onClick={openFileDialog} disabled={loading}>
                      Choose file
                    </button>
                  </div>
                </div>

                {(pendingFile || displayName) && (
                  <div className="panel upload-bar">
                    <div className="upload-file">{pendingFile ? pendingFile.name : 'No file selected'}</div>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Display name (optional)"
                      className="display-name-input"
                      disabled={loading}
                    />
                    <button className="outline-btn upload-btn" onClick={() => void confirmUpload()} disabled={!pendingFile || loading}>
                      {loading ? 'Uploading...' : 'Upload'}
                    </button>
                    <button className="outline-btn clear-btn" onClick={clearUpload} disabled={loading}>
                      Clear
                    </button>
                  </div>
                )}

                <div className="panel docs-table-panel">
                  <div className="table-wrap">
                    <table className="docs-table">
                      <thead>
                        <tr>
                          <th>Use</th>
                          <th>Document Name</th>
                          <th>Status</th>
                          <th>Chunks</th>
                          <th>Date Added</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="empty-cell">
                              No documents available.
                            </td>
                          </tr>
                        ) : (
                          documents.map((document) => (
                            <tr key={document.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(document.id)}
                                  onChange={() => toggleSelectedDocument(document.id)}
                                  aria-label={`Select ${document.name}`}
                                />
                              </td>
                              <td className="doc-name">{normalizeMojibakeText(document.name)}</td>
                              <td>
                                <span className={`status-pill ${statusClass(document.status)}`}>
                                  {statusLabel(document.status)}
                                </span>
                              </td>
                              <td>{document.chunkCount}</td>
                              <td>{formatDate(document.createdAt)}</td>
                              <td>
                                <button className="outline-btn danger" onClick={() => void remove(document.id)} disabled={loading}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'System Info' && (
              <section className="settings-view">
                <div className="panel settings-panel">
                  <h2>System Information</h2>
                  <p>Project: RAG Document Intelligence System</p>
                  <p>
                    Purpose: Ingest internal files, retrieve relevant context, and generate grounded answers with
                    citations.
                  </p>
                  <p>Supported document formats: PDF, DOCX, TXT</p>
                  <p>Retrieval engine: Semantic vector search with pgvector chunks</p>
                  <p>Generation strategy: Provider fallback chain (Gemini to Groq)</p>
                  <p>Current response model: {messages[messages.length - 1]?.model || 'Not queried yet (auto fallback enabled)'}</p>
                  <p>
                    <strong>Top K Parameter:</strong> The maximum number of document chunks retrieved from the semantic database to construct the prompt context. A higher value provides more background information but may dilute focus or increase token costs. A lower value provides strict, precise focus.
                  </p>
                  <p>Fallback mechanism:</p>
                  <ul className="settings-list">
                    <li>Start with primary Gemini model configured on backend.</li>
                    <li>If transient overload happens (429/503), retry same model with exponential backoff.</li>
                    <li>If retry fails, switch to next fallback model in the same provider.</li>
                    <li>Then switch provider in order: Gemini to Groq.</li>
                    <li>
                      If all providers fail, return a safe fallback response from nearest retrieved chunk (model: mock).
                    </li>
                  </ul>
                </div>
              </section>
            )}

            {activeTab === 'Profile' && (
              <section className="settings-view">
                <div className="panel settings-panel">
                  <h2>My Profile</h2>
                  <form className="auth-form" onSubmit={onProfileSubmit}>
                    <p className="auth-subtitle">Update your basic information here.</p>
                    <label>
                      Username
                      <input value={user.username} disabled style={{ backgroundColor: '#eaeaea' }} />
                    </label>
                    <label>
                      Email
                      <input value={user.email} disabled style={{ backgroundColor: '#eaeaea' }} />
                    </label>
                    <label>
                      Full name
                      <input
                        value={profileForm.fullName}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
                        placeholder="Enter your full name"
                      />
                    </label>
                    <label>
                      New Password
                      <div className="password-field">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={profileForm.password}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, password: event.target.value }))}
                          placeholder="Leave blank to keep same"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? '🙈' : '👁'}
                        </button>
                      </div>
                    </label>
                    <label>
                      Confirm New Password
                      <div className="password-field">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={profileForm.confirmPassword}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                          placeholder="Retype new password"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? '🙈' : '👁'}
                        </button>
                      </div>
                    </label>
                    <button type="submit" className="solid-btn" disabled={authLoading}>
                      {authLoading ? 'Updating...' : 'Update Profile'}
                    </button>
                  </form>
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="auth-view">
            <div className="panel auth-panel">
              <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
              <p className="auth-subtitle">
                {authMode === 'login'
                  ? 'Sign in to access your private document workspace.'
                  : 'Create your account to upload and query your own documents.'}
              </p>
              <form className="auth-form" onSubmit={onAuthSubmit}>
                <label>
                  Username
                  <input
                    value={authForm.username}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))}
                    required
                  />
                </label>
                {authMode === 'register' && (
                  <>
                    <label>
                      Email
                      <input
                        type="email"
                        value={authForm.email}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Full name
                      <input
                        value={authForm.fullName}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      />
                    </label>
                  </>
                )}
                <label>
                  Password
                  <div className="password-field">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={authForm.password}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </label>

                {authMode === 'register' && (
                  <label>
                    Confirm password
                    <div className="password-field">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={authForm.confirmPassword}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </label>
                )}

                <button type="submit" className="solid-btn" disabled={authLoading}>
                  {authLoading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
                </button>
              </form>
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => {
                  setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'));
                  setShowPassword(false);
                  setAuthForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                }}
                disabled={authLoading}
              >
                {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
