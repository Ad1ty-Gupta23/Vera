import EmptyState from '../../components/common/EmptyState';

export default function ComingSoon({ title, description, stage }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
      <p className="text-sm text-slate-500 mt-1">{description}</p>

      <div className="mt-6">
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
