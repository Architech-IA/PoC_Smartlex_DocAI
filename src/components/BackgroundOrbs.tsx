'use client';

export default function BackgroundOrbs() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* Indigo — top right */}
      <div className="absolute" style={{
        top: '-40px', right: '5%',
        width: '520px', height: '460px',
        background: 'rgba(99,102,241,0.22)',
        filter: 'blur(120px)',
        borderRadius: '62% 38% 45% 55% / 55% 45% 60% 40%',
      }} />
      {/* Amber — top left (Smartlex brand) */}
      <div className="absolute" style={{
        top: '5%', left: '3%',
        width: '400px', height: '420px',
        background: 'rgba(245,158,11,0.14)',
        filter: 'blur(130px)',
        borderRadius: '55% 45% 60% 40% / 40% 60% 45% 55%',
      }} />
      {/* Cyan — center */}
      <div className="absolute" style={{
        top: '25%', left: '30%',
        width: '380px', height: '340px',
        background: 'rgba(14,165,233,0.16)',
        filter: 'blur(110px)',
        borderRadius: '40% 60% 55% 45% / 45% 55% 40% 60%',
      }} />
      {/* Teal — bottom right */}
      <div className="absolute" style={{
        top: '55%', right: '15%',
        width: '340px', height: '320px',
        background: 'rgba(45,212,191,0.14)',
        filter: 'blur(110px)',
        borderRadius: '45% 55% 40% 60% / 60% 40% 55% 45%',
      }} />
      {/* Slate — bottom left subtle */}
      <div className="absolute" style={{
        bottom: '-20px', left: '20%',
        width: '360px', height: '300px',
        background: 'rgba(148,163,184,0.07)',
        filter: 'blur(120px)',
        borderRadius: '50% 50% 60% 40% / 45% 55% 50% 50%',
      }} />
    </div>
  );
}
