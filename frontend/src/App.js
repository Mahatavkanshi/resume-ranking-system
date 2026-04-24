import './App.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseAuthConfigured, supabase } from './supabaseClient';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const RECRUITER_EMAIL = (process.env.REACT_APP_RECRUITER_EMAIL || 'mahatavkanshisaini@gmail.com').toLowerCase();
const RECRUITER_DEFAULT_PASSWORD = process.env.REACT_APP_RECRUITER_PASSWORD || 'sajalsaini';
const AUTH_TIMEOUT_MS = 15000;

function withTimeout(promise, timeoutMs = AUTH_TIMEOUT_MS) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Auth request timed out. Check internet and Supabase project status.'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function getAuthErrorMessage(error) {
  const message = String(error?.message || error || 'Authentication failed');
  const lower = message.toLowerCase();

  if (lower.includes('email not confirmed')) {
    return 'Email not confirmed. Open your Supabase verification email, then login again.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password. Check credentials and try again.';
  }

  return message;
}

function App() {
  const [authTab, setAuthTab] = useState('candidate-login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePassword, setCandidatePassword] = useState('');
  const [recruiterPassword, setRecruiterPassword] = useState(RECRUITER_DEFAULT_PASSWORD);

  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');

  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [mustHaveSkills, setMustHaveSkills] = useState('');
  const [niceToHaveSkills, setNiceToHaveSkills] = useState('');
  const [createJobMessage, setCreateJobMessage] = useState('');

  const [selectedJobId, setSelectedJobId] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [latestScoring, setLatestScoring] = useState(null);

  const [candidates, setCandidates] = useState([]);
  const [candidateSubmissions, setCandidateSubmissions] = useState([]);

  const selectedJob = useMemo(
    () => jobs.find((item) => item.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const authHeaders = useMemo(() => {
    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`
    };
  }, [token]);

  const activeEmail = String(user?.email || '').toLowerCase();
  const isRecruiterUser = Boolean(user) && activeEmail === RECRUITER_EMAIL;
  const isCandidateUser = Boolean(user) && !isRecruiterUser;
  const currentRoleLabel = isRecruiterUser ? 'Recruiter Dashboard' : isCandidateUser ? 'Candidate Dashboard' : 'Welcome';

  useEffect(() => {
    if (!isSupabaseAuthConfigured || !supabase) {
      setAuthError('Supabase auth is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
      return;
    }

    let mounted = true;

    const syncSession = (session) => {
      if (!mounted) {
        return;
      }

      const loggedUser = session?.user || null;
      setUser(loggedUser);
      setToken(session?.access_token || '');
    };

    supabase.auth.getSession().then(({ data }) => {
      syncSession(data?.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session || null);
      setAuthError('');
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const apiGet = useCallback(async (path) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        ...authHeaders
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }, [authHeaders]);

  const apiPostJson = useCallback(async (path, body) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }, [authHeaders]);

  const loadJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      setJobsError('');
      const data = await apiGet('/jobs');
      const list = data.jobs || [];
      setJobs(list);

      if (!selectedJobId && list.length > 0) {
        setSelectedJobId(list[0].id);
      }
    } catch (error) {
      setJobsError(error.message);
    } finally {
      setJobsLoading(false);
    }
  }, [apiGet, selectedJobId]);

  const loadDashboardData = useCallback(async () => {
    try {
      if (isRecruiterUser) {
        const data = await apiGet('/recruiter/candidates');
        setCandidates(data.candidates || []);
      }

      if (isCandidateUser) {
        const data = await apiGet('/candidate/submissions');
        setCandidateSubmissions(data.submissions || []);
      }
    } catch (error) {
      setSubmitMessage(error.message);
    }
  }, [apiGet, isRecruiterUser, isCandidateUser]);

  useEffect(() => {
    if (!token) {
      return;
    }

    loadJobs();
    loadDashboardData();
  }, [token, loadJobs, loadDashboardData]);

  const signInRecruiter = async () => {
    setAuthError('');

    if (!supabase) {
      setAuthError('Supabase client not ready.');
      return;
    }

    if (!recruiterPassword.trim()) {
      setAuthError('Enter recruiter password to continue.');
      return;
    }

    try {
      setAuthLoading(true);
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: RECRUITER_EMAIL,
          password: recruiterPassword
        })
      );

      if (error) {
        setAuthError(getAuthErrorMessage(error));
      }
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signInCandidate = async () => {
    setAuthError('');

    if (!supabase) {
      setAuthError('Supabase client not ready.');
      return;
    }

    if (!candidateEmail.trim() || !candidatePassword.trim()) {
      setAuthError('Enter candidate email and password.');
      return;
    }

    if (candidateEmail.trim().toLowerCase() === RECRUITER_EMAIL) {
      setAuthError('This email is reserved for recruiter. Use Recruiter Access panel.');
      return;
    }

    try {
      setAuthLoading(true);
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: candidateEmail.trim(),
          password: candidatePassword
        })
      );

      if (error) {
        setAuthError(getAuthErrorMessage(error));
      }
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signUpCandidate = async () => {
    setAuthError('');

    if (!supabase) {
      setAuthError('Supabase client not ready.');
      return;
    }

    if (!candidateEmail.trim() || !candidatePassword.trim()) {
      setAuthError('Enter candidate email and password for signup.');
      return;
    }

    if (candidateEmail.trim().toLowerCase() === RECRUITER_EMAIL) {
      setAuthError('Recruiter email cannot be used in candidate signup.');
      return;
    }

    if (candidatePassword.trim().length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    try {
      setAuthLoading(true);
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: candidateEmail.trim(),
          password: candidatePassword
        })
      );

      if (error) {
        setAuthError(getAuthErrorMessage(error));
        return;
      }

      if (data?.session) {
        setAuthError('Signup successful. Redirecting to candidate dashboard.');
      } else {
        setAuthError('Signup successful. Verify your email in Supabase inbox, then login as candidate.');
      }
      setAuthTab('candidate-login');
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setToken('');
    setCandidates([]);
    setCandidateSubmissions([]);
    setLatestScoring(null);
    setSubmitMessage('');
  };

  const createJob = async (event) => {
    event.preventDefault();
    setCreateJobMessage('');

    try {
      const data = await apiPostJson('/jobs', {
        title: jobTitle,
        description: jobDescription,
        mustHaveSkills,
        niceToHaveSkills
      });

      setCreateJobMessage(data.message || 'Job posted successfully.');
      setJobTitle('');
      setJobDescription('');
      setMustHaveSkills('');
      setNiceToHaveSkills('');
      await loadJobs();
      await loadDashboardData();
    } catch (error) {
      setCreateJobMessage(error.message);
    }
  };

  const submitResume = async (event) => {
    event.preventDefault();
    setSubmitMessage('');

    if (!selectedJobId) {
      setSubmitMessage('Select a job before uploading resume.');
      return;
    }

    if (!resumeFile) {
      setSubmitMessage('Attach a PDF resume first.');
      return;
    }

    const isPdf = resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setSubmitMessage('Only PDF resumes are supported.');
      return;
    }

    const formData = new FormData();
    formData.append('jobId', selectedJobId);
    formData.append('resume', resumeFile);

    try {
      const response = await fetch(`${API_BASE_URL}/candidate/submit`, {
        method: 'POST',
        headers: {
          ...authHeaders
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitMessage('Resume uploaded and scored successfully.');
      setLatestScoring(data.scoring || null);
      setResumeFile(null);
      await loadDashboardData();
    } catch (error) {
      setSubmitMessage(error.message);
    }
  };

  const loadCandidatesByJob = async (jobId) => {
    const endpoint = jobId ? `/recruiter/candidates?jobId=${encodeURIComponent(jobId)}` : '/recruiter/candidates';

    try {
      const data = await apiGet(endpoint);
      setCandidates(data.candidates || []);
    } catch (error) {
      setSubmitMessage(error.message);
    }
  };

  const downloadResume = async (submission) => {
    try {
      const response = await fetch(`${API_BASE_URL}/recruiter/submissions/${submission.id}/download`, {
        headers: {
          ...authHeaders
        }
      });

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(errorPayload.error || 'Download failed');
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = submission.file_name || 'resume.pdf';
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setSubmitMessage(error.message);
    }
  };

  if (!isSupabaseAuthConfigured) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Talent Match Studio</h1>
          <p className="error">Configure frontend env first:</p>
          <p className="error">REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel">
        <header className="hero">
          <p className="eyebrow">Production Resume Intelligence Platform</p>
          <h1>Talent Match Studio</h1>
          <p>
            {currentRoleLabel} {user?.email ? `- ${user.email}` : ''}
          </p>
        </header>

        {!user && (
          <section className="auth-grid">
            <article className="auth-card recruiter-card">
              <h2>Recruiter Access</h2>
              <p>Only one recruiter account is allowed for now.</p>
              <label>Recruiter Email</label>
              <input type="email" value={RECRUITER_EMAIL} readOnly />
              <label>Recruiter Password</label>
              <input
                type="password"
                value={recruiterPassword}
                onChange={(event) => setRecruiterPassword(event.target.value)}
              />
              <button type="button" onClick={signInRecruiter} disabled={authLoading}>
                {authLoading ? 'Signing in...' : 'Login as Recruiter'}
              </button>
            </article>

            <article className="auth-card candidate-card">
              <h2>Candidate Access</h2>
              <div className="mini-tabs">
                <button
                  type="button"
                  className={authTab === 'candidate-login' ? 'active' : ''}
                  onClick={() => setAuthTab('candidate-login')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authTab === 'candidate-signup' ? 'active' : ''}
                  onClick={() => setAuthTab('candidate-signup')}
                >
                  Signup
                </button>
              </div>

              <label>Candidate Email</label>
              <input
                type="email"
                placeholder="candidate@email.com"
                value={candidateEmail}
                onChange={(event) => setCandidateEmail(event.target.value)}
              />
              <label>Candidate Password</label>
              <input
                type="password"
                placeholder="Create strong password"
                value={candidatePassword}
                onChange={(event) => setCandidatePassword(event.target.value)}
              />

              {authTab === 'candidate-login' ? (
                <button type="button" onClick={signInCandidate} disabled={authLoading}>
                  {authLoading ? 'Logging in...' : 'Login as Candidate'}
                </button>
              ) : (
                <button type="button" onClick={signUpCandidate} disabled={authLoading}>
                  {authLoading ? 'Creating account...' : 'Signup as Candidate'}
                </button>
              )}
            </article>
          </section>
        )}

        {authError && <p className="error">{authError}</p>}

        {user && (
          <div className="toolbar">
            <button type="button" className="ghost" onClick={loadJobs}>
              Refresh Jobs
            </button>
            <button type="button" className="ghost" onClick={loadDashboardData}>
              Refresh Dashboard
            </button>
            <button type="button" className="danger" onClick={signOut}>
              Sign Out
            </button>
          </div>
        )}

        {jobsError && <p className="error">{jobsError}</p>}
        {jobsLoading && <p className="hint">Loading jobs...</p>}

        {isRecruiterUser && (
          <section className="grid-two">
            <article className="card">
              <h2>Post New Job</h2>
              <form onSubmit={createJob} className="stack">
                <label>Job Title</label>
                <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} required />

                <label>Job Description</label>
                <textarea
                  rows="5"
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  required
                />

                <label>Must-Have Skills (comma/new line)</label>
                <textarea
                  rows="3"
                  value={mustHaveSkills}
                  onChange={(event) => setMustHaveSkills(event.target.value)}
                  placeholder="react, node.js, sql"
                />

                <label>Nice-To-Have Skills (comma/new line)</label>
                <textarea
                  rows="3"
                  value={niceToHaveSkills}
                  onChange={(event) => setNiceToHaveSkills(event.target.value)}
                  placeholder="mongodb, python"
                />

                <button type="submit">Publish Job</button>
              </form>
              {createJobMessage && <p className="hint">{createJobMessage}</p>}
            </article>

            <article className="card">
              <h2>Recruiter Dashboard</h2>
              <label>Filter by Job</label>
              <select
                value={selectedJobId}
                onChange={(event) => {
                  const nextJobId = event.target.value;
                  setSelectedJobId(nextJobId);
                  loadCandidatesByJob(nextJobId);
                }}
              >
                <option value="">All Jobs</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Score</th>
                      <th>Matched Skills</th>
                      <th>Resume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td>{candidate.candidate_email}</td>
                        <td>{candidate.score}%</td>
                        <td>{(candidate.matched_skills || []).join(', ') || 'None'}</td>
                        <td>
                          <button type="button" className="ghost" onClick={() => downloadResume(candidate)}>
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                    {candidates.length === 0 && (
                      <tr>
                        <td colSpan="4">No candidate submissions yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {isCandidateUser && (
          <section className="grid-two">
            <article className="card">
              <h2>Available Jobs</h2>
              <div className="job-list">
                {jobs.map((job) => (
                  <label key={job.id} className={`job-item ${selectedJobId === job.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="job"
                      checked={selectedJobId === job.id}
                      onChange={() => setSelectedJobId(job.id)}
                    />
                    <span>{job.title}</span>
                    <small>{job.description}</small>
                    <small><strong>Must:</strong> {(job.must_have_skills || []).join(', ') || 'None'}</small>
                    <small><strong>Nice:</strong> {(job.nice_to_have_skills || []).join(', ') || 'None'}</small>
                  </label>
                ))}
                {jobs.length === 0 && <p className="hint">No jobs published yet.</p>}
              </div>
            </article>

            <article className="card">
              <h2>Candidate Dashboard</h2>
              <p className="hint">Selected Job: {selectedJob ? selectedJob.title : 'None'}</p>

              <form onSubmit={submitResume} className="stack">
                <label>Upload Resume (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                />
                <button type="submit">Submit Resume</button>
              </form>

              {latestScoring && (
                <div className="hint" aria-live="polite">
                  <strong>Latest Scoring Breakdown</strong>
                  <div>Must-have match: {latestScoring.mustHaveMatchedCount}/{latestScoring.mustHaveRequiredCount}</div>
                  <div>Nice-to-have match: {latestScoring.niceToHaveMatchedCount}/{latestScoring.niceToHaveRequiredCount}</div>
                </div>
              )}

              <h3>Your Submissions</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Score</th>
                      <th>Matched Skills</th>
                      <th>Missing Skills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidateSubmissions.map((item) => (
                      <tr key={item.id}>
                        <td>{item.file_name}</td>
                        <td>{item.score}%</td>
                        <td>{(item.matched_skills || []).join(', ') || 'None'}</td>
                        <td>{(item.missing_skills || []).join(', ') || 'None'}</td>
                      </tr>
                    ))}
                    {candidateSubmissions.length === 0 && (
                      <tr>
                        <td colSpan="4">No submissions yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {submitMessage && <p className="hint">{submitMessage}</p>}
      </section>
    </main>
  );
}

export default App;
