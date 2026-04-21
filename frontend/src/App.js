import './App.css';
import { useMemo, useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [failedFiles, setFailedFiles] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const hasResults = ranking.length > 0 || failedFiles.length > 0;

  const selectedFileNames = useMemo(
    () => selectedFiles.map((file) => file.name),
    [selectedFiles]
  );

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
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
        <h1>Resume Ranking System</h1>
        <p className="subtitle">
          Upload multiple resumes, provide a job description, and get candidates ranked by skill match.
        </p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label htmlFor="resumes" className="label-text">Upload Resumes (PDF)</label>
          <input
            id="resumes"
            name="resumes"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileChange}
          />

          {selectedFileNames.length > 0 && (
            <ul className="file-list">
              {selectedFileNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
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

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Ranking...' : 'Submit'}
          </button>
        </form>

        {error && <p className="error-box">{error}</p>}

        {hasResults && (
          <section className="results">
            <h2>Ranked Candidates</h2>
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
