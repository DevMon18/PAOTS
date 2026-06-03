import { useRef, useState } from 'react'

const SUPPORTED_TYPES = ['.pdf', '.psd', '.jpg', '.jpeg', '.png']
const SUPPORTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/x-photoshop', 'application/photoshop']
const MAX_SIZE_BYTES = 200 * 1024 * 1024 // 200MB

export default function FileUploader({ onFileSelect, error }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [fileError, setFileError] = useState('')

  function validateFile(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!SUPPORTED_TYPES.includes(ext)) {
      return `This file type is not supported. Please upload a .pdf, .psd, .jpg, or .png file.`
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File exceeds the 200MB limit. Please compress or resize the file before uploading.`
    }
    return null
  }

  function handleFile(file) {
    setFileError('')
    const err = validateFile(file)
    if (err) {
      setFileError(err)
      onFileSelect(null)
      return
    }
    setPreview({ name: file.name, size: file.size })
    onFileSelect(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function clearFile() {
    setPreview(null)
    setFileError('')
    onFileSelect(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex-col gap-2">
      {!preview ? (
        <div
          className={`file-drop-zone ${dragOver ? 'drag-over' : ''} ${error || fileError ? 'error-border' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <div className="file-drop-title">Drop layout file here</div>
          <div className="file-drop-sub">or click to browse · .pdf .psd .jpg .png · max 200MB</div>
        </div>
      ) : (
        <div className="file-preview">
          <div className="file-preview-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="flex-col gap-1" style={{ flex: 1, minWidth: 0 }}>
            <div className="text-sm font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview.name}
            </div>
            <div className="text-xs text-muted">{formatBytes(preview.size)}</div>
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={clearFile}>Remove</button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.psd,.jpg,.jpeg,.png"
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {(fileError || error) && (
        <div className="form-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {fileError || error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <input
          type="checkbox"
          id="file-pending"
          onChange={(e) => {
            if (e.target.checked) {
              clearFile()
              onFileSelect('pending')
            } else {
              onFileSelect(null)
            }
          }}
          style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
        />
        <label htmlFor="file-pending" className="text-sm text-muted">
          File to be submitted later
        </label>
      </div>
    </div>
  )
}
