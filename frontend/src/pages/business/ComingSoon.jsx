import EmptyState from '../../components/common/EmptyState';

export default function ComingSoon({ title, description, stage }) {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        {title}
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '24px' }}>{description}</p>

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px dashed rgba(180,195,255,0.12)',
        borderRadius: '16px',
        padding: '32px',
      }}>
        <EmptyState
          title="Not built yet"
          description={
            stage
              ? `This section is planned for ${stage} of the SaaS expansion and isn't implemented yet. Nothing here is faked — you'll see real data once it ships.`
              : "This section isn't implemented yet. Nothing here is faked — you'll see real data once it ships."
          }
        />
      </div>
    </div>
  );
}
