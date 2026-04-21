import './App.css';
import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const MAX_FILES = 10;

function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [failedFiles, setFailedFiles] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const hasResults = ranking.length > 0 || failedFiles.length > 0;

  const scoreSummary = useMemo(() => {
    if (ranking.length === 0) {
      return { topScore: 0, avgScore: 0 };
    }

    const scores = ranking.map((item) => Number(item.score) || 0);
    const topScore = Math.max(...scores);
    const total = scores.reduce((sum, value) => sum + value, 0);

    return {
      topScore,
      avgScore: Number((total / scores.length).toFixed(2))
    };
  }, [ranking]);

  const filteredRanking = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return ranking.filter((candidate) => {
      const score = Number(candidate.score) || 0;
      const inScoreRange = score >= minScore;
      if (!inScoreRange) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = [
        candidate.name,
        ...(candidate.matchedSkills || []),
        ...(candidate.missingSkills || [])
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [ranking, searchTerm, minScore]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedCandidate(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const isPdf = (file) => {
    if (!file) {
      return false;
    }

    const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
    const hasPdfMime = file.type === 'application/pdf';
    return hasPdfExtension || hasPdfMime;
  };

  const mergeSelectedFiles = (incomingFiles) => {
    const validFiles = incomingFiles.filter((file) => isPdf(file));
    const invalidCount = incomingFiles.length - validFiles.length;

    if (invalidCount > 0) {
      setError(`Ignored ${invalidCount} non-PDF file(s). Only PDF resumes are allowed.`);
    } else {
      setError('');
    }

    if (validFiles.length === 0) {
      return;
    }

    setSelectedFiles((currentFiles) => {
      const map = new Map();
      [...currentFiles, ...validFiles].forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        map.set(key, file);
      });

      const merged = Array.from(map.values());

      if (merged.length > MAX_FILES) {
        setError(`You can upload at most ${MAX_FILES} resumes at once.`);
      }

      return merged.slice(0, MAX_FILES);
    });
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    mergeSelectedFiles(files);
    event.target.value = '';
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    mergeSelectedFiles(droppedFiles);
  };

  const removeFile = (targetFile) => {
    setSelectedFiles((files) =>
      files.filter(
        (file) =>
          !(
            file.name === targetFile.name &&
            file.size === targetFile.size &&
            file.lastModified === targetFile.lastModified
          )
      )
    );
  };

  const clearForm = () => {
    setSelectedFiles([]);
    setJobDescription('');
    setRanking([]);
    setFailedFiles([]);
    setMeta(null);
    setError('');
    setSearchTerm('');
    setMinScore(0);
    setSelectedCandidate(null);
  };

  const exportCsv = () => {
    if (ranking.length === 0) {
      return;
    }

    const headers = ['Rank', 'Candidate', 'Score', 'Matched Skills', 'Missing Skills'];
    const rows = ranking.map((candidate, index) => [
      index + 1,
      candidate.name,
      candidate.score,
      (candidate.matchedSkills || []).join(' | '),
      (candidate.missingSkills || []).join(' | ')
    ]);

    const toCsvValue = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows]
      .map((row) => row.map(toCsvValue).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'ranked-candidates.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setRanking([]);
    setFailedFiles([]);
    setMeta(null);
    setSelectedCandidate(null);

    if (selectedFiles.length === 0) {
      setError('Please select at least one resume PDF.');
      return;
    }

    if (!jobDescription.trim()) {
      setError('Please enter a job description.');
      return;
    }

    if (selectedFiles.length > MAX_FILES) {
      setError(`Please upload a maximum of ${MAX_FILES} resumes.`);
      return;
    }

    const formData = new FormData();
    formData.append('jd', jobDescription);

    selectedFiles.forEach((file) => {
      formData.append('resumes', file);
    });

    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/upload-multiple`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong while ranking resumes.');
        if (data.failedFiles) {
          setFailedFiles(data.failedFiles);
        }
        return;
      }

      setRanking(data.ranking || []);
      setFailedFiles(data.failedFiles || []);
      setMeta(data.meta || null);
    } catch (requestError) {
      setError(`Unable to connect to backend at ${API_BASE_URL}.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="card">
        <p className="badge">Backend: {API_BASE_URL}</p>
        <h1>Resume Ranking System</h1>
        <p className="subtitle">
          Upload multiple resumes, provide a job description, and get candidates ranked by skill match.
        </p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label htmlFor="resumes" className="label-text">Upload Resumes (PDF, max {MAX_FILES})</label>
          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <p className="drop-title">Drag and drop resume PDFs here</p>
            <p className="drop-subtitle">or use file picker below</p>
          </div>
          <input
            id="resumes"
            name="resumes"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileChange}
          />

          {selectedFiles.length > 0 && (
            <ul className="file-list" aria-label="Selected resume files">
              {selectedFiles.map((file) => {
                const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
                return (
                  <li key={fileKey} className="file-chip">
                    <span>{file.name}</span>
                    <button type="button" className="icon-button" onClick={() => removeFile(file)}>
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <label htmlFor="jobDescription" className="label-text">Job Description</label>
          <textarea
            id="jobDescription"
            name="jobDescription"
            rows="6"
            placeholder="Paste job description or required skills here..."
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
          />

          <div className="actions-row">
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Ranking...' : 'Submit'}
            </button>
            <button type="button" className="ghost-button" onClick={clearForm} disabled={isLoading}>
              Clear
            </button>
            <button type="button" className="ghost-button" onClick={exportCsv} disabled={ranking.length === 0 || isLoading}>
              Export CSV
            </button>
          </div>
        </form>

        {error && <p className="error-box">{error}</p>}

        {hasResults && (
          <section className="results">
            <h2>Ranked Candidates</h2>

            <div className="filters-grid">
              <label className="label-text" htmlFor="search">Search Candidate / Skills</label>
              <input
                id="search"
                type="text"
                placeholder="e.g. react, sql, sejal"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              <label className="label-text" htmlFor="minScore">Minimum Score: {minScore}%</label>
              <input
                id="minScore"
                type="range"
                min="0"
                max="100"
                step="5"
                value={minScore}
                onChange={(event) => setMinScore(Number(event.target.value))}
              />
            </div>

            <div className="summary-grid">
              <article className="summary-card">
                <p>Total Candidates</p>
                <strong>{ranking.length}</strong>
              </article>
              <article className="summary-card">
                <p>Top Score</p>
                <strong>{scoreSummary.topScore}%</strong>
              </article>
              <article className="summary-card">
                <p>Average Score</p>
                <strong>{scoreSummary.avgScore}%</strong>
              </article>
              <article className="summary-card">
                <p>JD Skills</p>
                <strong>{meta?.jdSkills?.length || 0}</strong>
              </article>
            </div>

            {filteredRanking.length === 0 ? (
              <p className="empty-results">No candidates match the current filters.</p>
            ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Candidate</th>
                    <th>Score</th>
                    <th>Matched Skills</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRanking.map((candidate, index) => (
                    <tr key={candidate.name}>
                      <td>{index + 1}</td>
                      <td>{candidate.name}</td>
                      <td>
                        <div className="score-wrap">
                          <span>{candidate.score}%</span>
                          <div className="score-track" aria-hidden="true">
                            <div className="score-fill" style={{ width: `${candidate.score}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{(candidate.matchedSkills || []).join(', ') || 'None'}</td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setSelectedCandidate(candidate)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            {failedFiles.length > 0 && (
              <div className="failed-files">
                <h3>Files Not Processed</h3>
                <ul>
                  {failedFiles.map((file) => (
                    <li key={file.name}>{file.name}: {file.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      {selectedCandidate && (
        <div className="modal-overlay" onClick={() => setSelectedCandidate(null)} role="presentation">
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3>{selectedCandidate.name}</h3>
            <p className="modal-score">Score: {selectedCandidate.score}%</p>

            <div className="modal-section">
              <h4>Matched Skills</h4>
              <p>{(selectedCandidate.matchedSkills || []).join(', ') || 'None'}</p>
            </div>

            <div className="modal-section">
              <h4>Missing Skills</h4>
              <p>{(selectedCandidate.missingSkills || []).join(', ') || 'None'}</p>
            </div>

            <button type="button" onClick={() => setSelectedCandidate(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
