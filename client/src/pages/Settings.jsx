import { useState } from 'react';
import { Card } from '../components/Primitives';
import { useAppContext } from '../App';

const EditableList = ({ title, items, onAdd, onRemove, placeholder }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput('');
  };

  return (
    <Card title={title}>
      <ul className="pill-list">
        {items.length ? (
          items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button type="button" className="chip ghost clear" onClick={() => onRemove(item)}>
                ×
              </button>
            </li>
          ))
        ) : (
          <li className="empty-state">No entries yet.</li>
        )}
      </ul>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
        />
        <button type="submit">Add</button>
      </form>
    </Card>
  );
};

const SettingsPage = () => {
  const {
    options,
    reasonPresets,
    planOptions,
    tempSettings,
    setTempSettings,
    setOptions,
    setPlanOptions
  } = useAppContext();

  const updateList = (listName, updater, optionKey) => {
    setTempSettings((prev) => {
      const updated = updater(prev?.[listName] || []);
      if (optionKey) {
        setOptions((prevOptions) => ({
          ...prevOptions,
          [optionKey]: updated
        }));
      }
      if (listName === 'plans') {
        setPlanOptions(updated);
      }
      return {
        ...prev,
        [listName]: updated
      };
    });
  };

  return (
    <div className="settings-grid">
      <EditableList
        title="Closers"
        items={tempSettings?.closers || []}
        placeholder="Add closer"
        onAdd={(value) => updateList('closers', (list) => [...list, value], 'closers')}
        onRemove={(value) => updateList('closers', (list) => list.filter((item) => item !== value), 'closers')}
      />
      <EditableList
        title="Agent types"
        items={tempSettings?.agentTypes || options.agentTypes || []}
        placeholder="Add agent type"
        onAdd={(value) => updateList('agentTypes', (list) => [...list, value], 'agentTypes')}
        onRemove={(value) => updateList('agentTypes', (list) => list.filter((item) => item !== value), 'agentTypes')}
      />
      <EditableList
        title="Plans"
        items={tempSettings?.plans || planOptions}
        placeholder="Add plan"
        onAdd={(value) => updateList('plans', (list) => [...list, value])}
        onRemove={(value) => updateList('plans', (list) => list.filter((item) => item !== value))}
      />
      <EditableList
        title="Reason presets"
        items={tempSettings?.reasons?.length ? tempSettings.reasons : reasonPresets}
        placeholder="Add reason"
        onAdd={(value) => updateList('reasons', (list) => [...list, value], 'reasons')}
        onRemove={(value) => updateList('reasons', (list) => list.filter((item) => item !== value), 'reasons')}
      />
      <Card title="Coming soon">
        <p>
          Saving these edits back to the database + campaign tracking management will arrive in Phase 4. For now,
          use this space to plan preset lists.
        </p>
      </Card>
    </div>
  );
};

export default SettingsPage;
