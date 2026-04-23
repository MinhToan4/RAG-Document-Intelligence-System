import { useState, type FormEvent } from 'react';

type FileUploaderProps = {
  disabled?: boolean;
  onUpload: (file: File, name?: string) => Promise<void>;
};

export function FileUploader({ disabled, onUpload }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      return;
    }
    await onUpload(file, name);
    setFile(null);
    setName('');
    const input = document.getElementById('upload-file-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  };

  return (
    <form className="card uploader" onSubmit={handleSubmit}>
      <h2>Upload Document</h2>
      <p className="muted">Accepted formats: PDF, DOCX, TXT</p>

      <label htmlFor="upload-file-input">Choose file</label>
      <input
        id="upload-file-input"
        type="file"
        accept=".pdf,.docx,.txt"
        disabled={disabled}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <label htmlFor="display-name">Display name (optional)</label>
      <input
        id="display-name"
        placeholder="Q3 Report.pdf"
        value={name}
        disabled={disabled}
        onChange={(event) => setName(event.target.value)}
      />

      <button type="submit" disabled={!file || disabled}>
        {disabled ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
}
