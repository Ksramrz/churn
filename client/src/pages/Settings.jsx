import { Card } from '../components/Primitives';
import { useAppContext } from '../App';

const SettingsPage = () => {
  const { options, reasonPresets, planOptions } = useAppContext();

  const renderList = (items, emptyLabel) =>
    items?.length ? items.map((item) => <li key={item}>{item}</li>) : <li className="empty-state">{emptyLabel}</li>;

  return (
    <div className="settings-grid">
      <Card title="Closers">
        <ul className="pill-list">{renderList(options.closers, 'Add closers via DB migration to manage here.')}</ul>
      </Card>
      <Card title="Agent types">
        <ul className="pill-list">{renderList(options.agentTypes, 'No agent types detected yet.')}</ul>
      </Card>
      <Card title="Plans">
        <ul className="pill-list">{planOptions.map((plan) => <li key={plan}>{plan}</li>)}</ul>
      </Card>
      <Card title="Reason presets">
        <ul className="pill-list">
          {(options.reasons?.length ? options.reasons : reasonPresets).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Card>
      <Card title="Coming soon">
        <p>
          Soon you&apos;ll be able to edit these lists directly, manage campaign tracking, and configure alerts without
          touching the database.
        </p>
      </Card>
    </div>
  );
};

export default SettingsPage;
