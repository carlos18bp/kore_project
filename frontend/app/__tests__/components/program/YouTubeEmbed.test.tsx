import { render, screen, fireEvent } from '@testing-library/react';
import YouTubeEmbed from '@/app/components/program/YouTubeEmbed';

describe('YouTubeEmbed', () => {
  it('renders nothing when the url has no extractable video id', () => {
    const { container } = render(<YouTubeEmbed url="https://example.com/not-a-video" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a play button for a standard youtube.com watch url', () => {
    render(<YouTubeEmbed url="https://youtube.com/watch?v=abc123" title="Sentadilla" />);

    expect(screen.getByRole('button', { name: 'Reproducir video: Sentadilla' })).toBeInTheDocument();
  });

  it('renders a play button for a shortened youtu.be url', () => {
    render(<YouTubeEmbed url="https://youtu.be/xyz789" title="Press banca" />);

    expect(screen.getByRole('button', { name: 'Reproducir video: Press banca' })).toBeInTheDocument();
  });

  it('shows the video thumbnail with the title as alt text', () => {
    render(<YouTubeEmbed url="https://youtube.com/watch?v=abc123" title="Sentadilla" />);

    expect(screen.getByRole('img', { name: 'Sentadilla' })).toBeInTheDocument();
  });

  it('swaps the thumbnail for the player iframe when the play button is clicked', () => {
    render(<YouTubeEmbed url="https://youtube.com/watch?v=abc123" title="Sentadilla" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir video: Sentadilla' }));

    expect(screen.getByTitle('Sentadilla')).toBeInTheDocument();
  });

  it('shows an unavailable message when the thumbnail fails to load', () => {
    render(<YouTubeEmbed url="https://youtube.com/watch?v=abc123" title="Sentadilla" />);

    fireEvent.error(screen.getByRole('img', { name: 'Sentadilla' }));

    expect(screen.getByText('Video no disponible')).toBeInTheDocument();
  });
});
