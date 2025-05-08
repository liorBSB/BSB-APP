export default function ListItem({ icon, title, subtitle, action, statusColor = 'bg-success', statusText }) {
  return (
    <div className="flex items-center justify-between bg-background rounded-lg shadow-sm p-3 mb-3">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="font-medium text-text text-sm">{title}</div>
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
        </div>
      </div>
      {action && (
        <button className={`px-3 py-1 rounded-md text-white text-xs font-semibold ${statusColor}`}>{action}</button>
      )}
      {statusText && (
        <span className={`px-3 py-1 rounded-md text-white text-xs font-semibold ${statusColor}`}>{statusText}</span>
      )}
    </div>
  );
} 