import { Card } from '../components/Primitives';
import { useAppContext } from '../App';

const InsightsPage = () => {
  const { overview } = useAppContext();
  const insights = overview?.insights || [];

  return (
    <div className="page-grid">
      <Card title="Automated insights" subtitle="Rules-only alerts sourced from live churn data">
        <ul className="insights">
          {insights.length ? (
            insights.map((insight, index) => <li key={index}>{insight}</li>)
          ) : (
            <li>Insights will appear once data loads.</li>
          )}
        </ul>
      </Card>
      <Card title="Playbook notes" subtitle="COMING SOON">
        <p className="empty-state">
          Manual insight curation, tagging, and sharing will live here so ops leads can add context to the automated
          findings.
        </p>
      </Card>
    </div>
  );
};

export default InsightsPage;
