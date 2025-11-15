import { Card } from '../components/Primitives';
import { useAppContext } from '../App';

const IntakePage = () => {
  const {
    formData,
    handleFormChange,
    handleFormSubmit,
    formSubmitting,
    customerSuggestions,
    handleCustomerInput,
    clearCustomerSelection,
    selectCustomer,
    options,
    reasonPresets,
    planOptions,
    overview,
    resetForm
  } = useAppContext();

  return (
    <div className="page-grid">
      <Card title="Cancellation Intake">
        <form onSubmit={handleFormSubmit} className="form-grid">
          <label>
            Customer
            <div className="combo-input">
              <input
                value={formData.customerLookup}
                onChange={(e) => handleCustomerInput(e.target.value)}
                placeholder="Type name or email"
              />
              {formData.customerLookup && (
                <button type="button" className="chip ghost clear" onClick={clearCustomerSelection}>
                  ×
                </button>
              )}
            </div>
            {customerSuggestions.length > 0 && (
              <ul className="suggestions">
                {customerSuggestions.map((customer) => (
                  <li key={customer.id} onClick={() => selectCustomer(customer)}>
                    <span>{customer.name}</span>
                    <small>{customer.email}</small>
                  </li>
                ))}
              </ul>
            )}
          </label>

          <label>
            Zoho desk ticket
            <input
              type="url"
              value={formData.zoho_ticket_url}
              onChange={(e) => handleFormChange('zoho_ticket_url', e.target.value)}
              placeholder="https://desk.zoho.com/..."
            />
          </label>

          <label>
            Agent plan
            <select value={formData.agent_plan} onChange={(e) => handleFormChange('agent_plan', e.target.value)}>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </label>

          <label>
            Churn amount ($)
            <input
              type="number"
              min="0"
              value={formData.churn_amount}
              onChange={(e) => handleFormChange('churn_amount', e.target.value)}
            />
          </label>

          <label>
            Closer
            <input
              value={formData.closer_name}
              onChange={(e) => handleFormChange('closer_name', e.target.value)}
              placeholder="Type or pick a Roomvu teammate"
              list="closerOptions"
            />
            <datalist id="closerOptions">
              {options.closers?.map((closer) => (
                <option key={closer} value={closer} />
              ))}
            </datalist>
          </label>

          <label>
            Cancellation date
            <input
              type="date"
              value={formData.cancellation_date}
              onChange={(e) => handleFormChange('cancellation_date', e.target.value)}
            />
          </label>

          <label>
            Primary reason
            <input
              value={formData.primary_reason}
              onChange={(e) => handleFormChange('primary_reason', e.target.value)}
              placeholder="Content not relevant, Not getting results..."
            />
            <div className="chip-group">
              {(options.reasons?.length ? options.reasons : reasonPresets).slice(0, 6).map((reason) => (
                <button
                  type="button"
                  key={reason}
                  className={`chip ${formData.primary_reason === reason ? 'active' : ''}`}
                  onClick={() => handleFormChange('primary_reason', reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
          </label>

          <label className="full">
            Secondary notes
            <textarea
              value={formData.secondary_notes}
              onChange={(e) => handleFormChange('secondary_notes', e.target.value)}
              rows={2}
            />
          </label>

          <label>
            Usage downloads
            <input
              type="number"
              min="0"
              value={formData.usage_downloads}
              onChange={(e) => handleFormChange('usage_downloads', e.target.value)}
            />
          </label>

          <label>
            Usage posts
            <input
              type="number"
              min="0"
              value={formData.usage_posts}
              onChange={(e) => handleFormChange('usage_posts', e.target.value)}
            />
          </label>

          <label>
            Usage logins
            <input
              type="number"
              min="0"
              value={formData.usage_logins}
              onChange={(e) => handleFormChange('usage_logins', e.target.value)}
            />
          </label>

          <label>
            Usage minutes
            <input
              type="number"
              min="0"
              value={formData.usage_minutes}
              onChange={(e) => handleFormChange('usage_minutes', e.target.value)}
            />
          </label>

          <label className="toggle full">
            <input
              type="checkbox"
              checked={formData.saved_flag}
              onChange={(e) => handleFormChange('saved_flag', e.target.checked)}
            />
            Saved on the call?
          </label>

          {formData.saved_flag && (
            <>
              <label>
                Saved revenue kept ($)
                <input
                  type="number"
                  min="0"
                  value={formData.saved_revenue}
                  onChange={(e) => handleFormChange('saved_revenue', e.target.value)}
                />
              </label>
              <label>
                Saved by
                <input
                  value={formData.saved_by}
                  onChange={(e) => handleFormChange('saved_by', e.target.value)}
                />
              </label>
              <label>
                Save reason / offer
                <input
                  value={formData.save_reason}
                  onChange={(e) => handleFormChange('save_reason', e.target.value)}
                />
              </label>
              <label className="full">
                Save notes
                <textarea
                  value={formData.save_notes}
                  onChange={(e) => handleFormChange('save_notes', e.target.value)}
                  rows={2}
                />
              </label>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="ghost" onClick={resetForm}>
              Reset
            </button>
            <button type="submit" disabled={formSubmitting}>
              {formSubmitting ? 'Saving...' : 'Log cancellation'}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Auto insights" subtitle="Rule-based callouts from the latest data">
        <ul className="insights">
          {overview?.insights?.map((insight, index) => (
            <li key={index}>{insight}</li>
          ))}
          {!overview?.insights?.length && <li>Insights will appear once data loads.</li>}
        </ul>
      </Card>
    </div>
  );
};

export default IntakePage;
