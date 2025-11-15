export const Card = ({ title, actions, children, subtitle }) => (
  <div className="card">
    {(title || actions || subtitle) && (
      <div className="card-header">
        <div>
          {title && <h3>{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </div>
);

export const Kpi = ({ label, value, helper }) => (
  <div className="kpi">
    <p>{label}</p>
    <strong>{value}</strong>
    {helper && <span>{helper}</span>}
  </div>
);

export const Table = ({ columns, rows, emptyLabel }) => (
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.accessor}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={col.accessor}>{row[col.accessor]}</td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="empty-state">
              {emptyLabel}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

