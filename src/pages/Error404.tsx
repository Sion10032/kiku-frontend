import { Link } from '@tanstack/react-router';
import { M3eButton } from '@m3e/react/button';

/** 404 页面。步骤 15 完善样式。 */
export default function Error404() {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        height: '100dvh',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ color: 'var(--m3e-on-surface-variant, #666)' }}>
        页面不存在
      </p>
      <Link to="/works" style={{ textDecoration: 'none' }}>
        <M3eButton variant="filled">返回作品库</M3eButton>
      </Link>
    </section>
  );
}
