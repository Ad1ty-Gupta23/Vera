function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 mb-0.5">{label}</p>
      <p className="text-xs text-slate-300">{value ?? <span className="text-slate-600">—</span>}</p>
    </div>
  );
}

export default function AgentStatePanel({ currentIntent, previousIntent, location, agentStatus, confidence, urgency, currentAction }) {
  const hasData = currentIntent || agentStatus !== 'idle';

  const urgencyColor =
    urgency === 'critical' ? 'text-red-400' :
    urgency === 'high'     ? 'text-amber-400' :
                             'text-slate-300';

  return (
    <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-4">
      <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 mb-3">Agent State</p>
      {!hasData ? (
        <p className="text-xs text-slate-600">Awaiting agent activity</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Field label="Intent" value={currentIntent} />
          {previousIntent && previousIntent !== currentIntent && (
            <Field label="Previous" value={previousIntent} />
          )}
          {confidence != null && (
            <Field label="Confidence" value={`${Math.round(confidence * 100)}%`} />
          )}
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 mb-0.5">Urgency</p>
            <p className={`text-xs font-medium ${urgencyColor}`}>{urgency ?? 'normal'}</p>
          </div>
          {currentAction && <Field label="Action" value={currentAction} />}
          <Field label="Location" value={location ? 'Available' : 'Not available'} />
          <Field label="Status" value={agentStatus} />
        </div>
      )}
    </div>
  );
}
