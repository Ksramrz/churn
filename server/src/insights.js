const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const generateInsights = ({
  totalCancellations,
  reasonCounts,
  earlyChurnCount,
  closerStats,
  campaignChurn,
  savedRate
}) => {
  const insights = [];
  if (!totalCancellations) {
    return ['No churn data yet. Keep capturing cancellation calls to unlock insights.'];
  }

  const reasonEntries = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
  if (reasonEntries.length) {
    const [topReason, count] = reasonEntries[0];
    const share = count / totalCancellations;
    if (topReason === 'Content not relevant' && share > 0.25) {
      insights.push(
        `Content strategy misalignment: ${formatPercent(share)} of churn cites "Content not relevant". Partner with marketing to refresh Roomvu content packs for that segment.`
      );
    } else if (share > 0.2) {
      insights.push(
        `Primary churn driver: ${formatPercent(share)} of lost accounts cite "${topReason}". Prioritize fixes and enablement materials around this reason.`
      );
    }
  }

  const earlyChurnRate = earlyChurnCount / totalCancellations;
  if (earlyChurnRate > 0.4) {
    insights.push(
      `Onboarding gap: ${formatPercent(
        earlyChurnRate
      )} of Roomvu churn happens within the first week. Tighten welcome journeys, customer success touchpoints, and in-app walkthroughs.`
    );
  }

  const avgSaveRate =
    closerStats.reduce((sum, closer) => sum + closer.saveRate, 0) / closerStats.length || 0;

  closerStats.forEach((closer) => {
    if (closer.total > 0 && closer.saveRate + 0.15 < avgSaveRate) {
      insights.push(
        `Closer coaching: ${closer.name} is saving ${formatPercent(
          closer.saveRate
        )} of calls vs the team average ${formatPercent(avgSaveRate)}. Schedule a shadow + refresher.`
      );
    }
  });

  const campaigns = Object.entries(campaignChurn)
    .map(([campaign, { cancellations, customers }]) => ({
      campaign,
      rate: customers ? cancellations / customers : 0
    }))
    .filter((entry) => entry.rate > 0);

  if (campaigns.length) {
    const highest = campaigns.sort((a, b) => b.rate - a.rate)[0];
    if (highest.rate > 0.2) {
      insights.push(
        `Campaign quality check: ${highest.campaign} is driving ${formatPercent(
          highest.rate
        )} churn of its cohort. Review targeting, messaging, and follow-up journeys.`
      );
    }
  }

  if (savedRate < 0.2) {
    insights.push(
      `Retention program opportunity: overall save rate is ${formatPercent(
        savedRate
      )}. Consider refreshed offers or enablement assets.`
    );
  }

  if (!insights.length) {
    insights.push('Churn mix looks balanced. Continue monitoring weekly to catch new trends early.');
  }

  return insights;
};

module.exports = {
  generateInsights
};

