/**
 * UI component for file uploader. Encapsulates rendering logic and user interactions for this feature.
 */
import { useState, type FormEvent } from 'react';

/**
 * Props for the FileUploader component.
 */
type FileUploaderProps = {
  disabled?: boolean;
  onUpload: (file: File, name?: string) => Promise<void>;
};

/**
 * A UI component that provides a form for users to select and upload documents.
 * Handles local state for the selected file and an optional display name.
 *
 * @param props - Component properties conforming to FileUploaderProps
 * @returns The rendered FileUploader React element
 */
export function FileUploader({ disabled, onUpload }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');

  /**
   * Handles the form submission by preventing default behavior,
   * triggering the parent onUpload callback, and resetting the form state.
   *
   * @param event - The form submission event
   */
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
