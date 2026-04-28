import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadForm from '../components/UploadForm'
import * as api from '../api'

vi.mock('../api', () => ({
  fetchLanguages: vi.fn(),
  translatePdf: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchLanguages.mockResolvedValue({ es: 'Spanish', fr: 'French' })
})

describe('UploadForm', () => {
  it('renders drop zone with correct ARIA attributes', async () => {
    render(<UploadForm onResult={() => {}} />)
    const dropZone = await screen.findByRole('button', { name: /drop zone/i })
    expect(dropZone).toBeInTheDocument()
    expect(dropZone).toHaveAttribute('tabindex', '0')
  })

  it('loads and displays language options', async () => {
    render(<UploadForm onResult={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('Spanish')).toBeInTheDocument()
      expect(screen.getByText('French')).toBeInTheDocument()
    })
  })

  it('shows error when no language selected on submit', async () => {
    render(<UploadForm onResult={() => {}} />)
    await waitFor(() => screen.getByText('Spanish'))

    const submitBtn = screen.getByRole('button', { name: /translate/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/please select a pdf/i)).toBeInTheDocument()
  })

  it('shows error when languages fail to load', async () => {
    api.fetchLanguages.mockRejectedValue(new Error('Network error'))
    render(<UploadForm onResult={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText(/failed to load languages/i)).toBeInTheDocument()
    })
  })

  it('drop zone responds to keyboard Enter', async () => {
    render(<UploadForm onResult={() => {}} />)
    const dropZone = await screen.findByRole('button', { name: /drop zone/i })
    // Should not throw when Enter is pressed
    fireEvent.keyDown(dropZone, { key: 'Enter' })
  })
})
