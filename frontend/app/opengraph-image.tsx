import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'KÓRE Health - Entrenador Personal en Bogotá';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #FAF8F5 0%, #F5F0EB 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Flower background */}
        <div
          style={{
            position: 'absolute',
            right: '80px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '400px',
            height: '400px',
            opacity: 0.9,
            display: 'flex',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://korehealths.com/images/flower.webp"
            alt=""
            width={400}
            height={400}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingLeft: '80px',
            paddingRight: '500px',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Brand */}
          <div
            style={{
              fontSize: '24px',
              color: '#7A2D2D',
              letterSpacing: '0.3em',
              marginBottom: '20px',
              fontWeight: 600,
            }}
          >
            KÓRE HEALTH
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 700,
              color: '#2D2D2D',
              lineHeight: 1.1,
              marginBottom: '24px',
            }}
          >
            Entrenador Personal en Bogotá
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '24px',
              color: '#666666',
              lineHeight: 1.4,
              maxWidth: '500px',
            }}
          >
            Metodología KÓRE: movimiento consciente, salud integral y procesos personalizados
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
