import './App.css';
import { useMemo, useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const MAX_FILES = 10;

function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [failedFiles, setFailedFiles] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setRanking([]);
    setFailedFiles([]);

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
          </div>
        </form>

        {error && <p className="error-box">{error}</p>}

        {hasResults && (
          <section className="results">
            <h2>Ranked Candidates</h2>
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
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Candidate</th>
                    <th>Score</th>
                    <th>Matched Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((candidate, index) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
    </div>
  );
}

export default App;
