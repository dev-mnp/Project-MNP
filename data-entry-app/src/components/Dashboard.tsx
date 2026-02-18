import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type DashboardMetrics = {
  district: {
    districtsReceived: number;
    districtsPending: number;
    totalArticlesQty: number;
    uniqueArticles: number;
    totalBeneficiaries: number;
    totalAllottedFund: number;
    totalValueAccrued: number;
  };
  districtUtilization: {
    id: string;
    name: string;
    allotted: number;
    used: number;
    remaining: number;
    utilizationPct: number;
  }[];
  public: {
    totalBeneficiaries: number;
    totalArticlesQty: number;
    uniqueArticles: number;
    totalValueAccrued: number;
    gender: {
      male: number;
      female: number;
      transgender: number;
    };
    femaleStatus: {
      unmarried: number;
      married: number;
      widow: number;
      singleMother: number;
    };
    handicapped: number;
  };
  institutions: {
    totalBeneficiaries: number;
    applicationCount: number;
    totalArticlesQty: number;
    uniqueArticles: number;
    totalValueAccrued: number;
  };
  overall: {
    totalBeneficiaries: number;
    totalArticlesQty: number;
    uniqueArticles: number;
    totalValueAccrued: number;
  };
  fundRequests: {
    count: number;
    totalValue: number;
  };
  totalDistricts: number;
  pendingDistricts: string[];
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numberFormat = useMemo(
    () => new Intl.NumberFormat('en-IN'),
    []
  );
  const currencyFormat = useMemo(
    () => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }),
    []
  );

  useEffect(() => {
    let isMounted = true;
    const loadMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          districtEntriesResult,
          publicEntriesResult,
          institutionsEntriesResult,
          districtMasterCountResult,
          districtMasterResult,
          fundRequestResult,
        ] = await Promise.all([
          supabase
            .from('district_beneficiary_entries')
            .select('district_id, article_id, quantity, total_amount'),
          supabase
            .from('public_beneficiary_entries')
            .select('article_id, quantity, total_amount, gender, female_status, is_handicapped'),
          supabase
            .from('institutions_beneficiary_entries')
            .select('article_id, quantity, total_amount, application_number'),
          supabase
            .from('district_master')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('district_master')
            .select('id, district_name, allotted_budget'),
          supabase
            .from('fund_request')
            .select('total_amount', { count: 'exact' }),
        ]);

        if (districtEntriesResult.error) throw districtEntriesResult.error;
        if (publicEntriesResult.error) throw publicEntriesResult.error;
        if (institutionsEntriesResult.error) throw institutionsEntriesResult.error;
        if (districtMasterCountResult.error) throw districtMasterCountResult.error;
        if (districtMasterResult.error) throw districtMasterResult.error;
        if (fundRequestResult.error) throw fundRequestResult.error;

        const districtEntries = districtEntriesResult.data || [];
        const publicEntries = publicEntriesResult.data || [];
        const institutionsEntries = institutionsEntriesResult.data || [];
        const totalDistricts = districtMasterCountResult.count || 0;
        const districtMaster = districtMasterResult.data || [];
        const fundRequestEntries = fundRequestResult.data || [];

        const districtArticleIds = new Set<string>();
        const districtIds = new Set<string>();
        let districtArticlesQty = 0;
        let districtValueAccrued = 0;
        districtEntries.forEach((entry) => {
          if (entry.article_id) districtArticleIds.add(entry.article_id);
          if (entry.district_id) districtIds.add(entry.district_id);
          districtArticlesQty += entry.quantity || 0;
          districtValueAccrued += Number(entry.total_amount || 0);
        });

        const publicArticleIds = new Set<string>();
        let publicArticlesQty = 0;
        let publicValueAccrued = 0;
        const genderCounts = { male: 0, female: 0, transgender: 0 };
        const femaleStatusCounts = {
          unmarried: 0,
          married: 0,
          widow: 0,
          singleMother: 0,
        };
        let handicapped = 0;
        publicEntries.forEach((entry) => {
          if (entry.article_id) publicArticleIds.add(entry.article_id);
          publicArticlesQty += entry.quantity || 0;
          publicValueAccrued += Number(entry.total_amount || 0);
          if (entry.gender === 'Male') genderCounts.male += 1;
          if (entry.gender === 'Female') genderCounts.female += 1;
          if (entry.gender === 'Transgender') genderCounts.transgender += 1;
          if (entry.female_status === 'Unmarried') femaleStatusCounts.unmarried += 1;
          if (entry.female_status === 'Married') femaleStatusCounts.married += 1;
          if (entry.female_status === 'Widow') femaleStatusCounts.widow += 1;
          if (entry.female_status === 'Single Mother') femaleStatusCounts.singleMother += 1;
          if (entry.is_handicapped) handicapped += 1;
        });

        const institutionsArticleIds = new Set<string>();
        const institutionsApplications = new Set<string>();
        let institutionsArticlesQty = 0;
        let institutionsValueAccrued = 0;
        institutionsEntries.forEach((entry) => {
          if (entry.article_id) institutionsArticleIds.add(entry.article_id);
          if (entry.application_number) institutionsApplications.add(entry.application_number);
          institutionsArticlesQty += entry.quantity || 0;
          institutionsValueAccrued += Number(entry.total_amount || 0);
        });

        const overallArticleIds = new Set<string>([
          ...Array.from(districtArticleIds),
          ...Array.from(publicArticleIds),
          ...Array.from(institutionsArticleIds),
        ]);
        const overallArticlesQty = districtArticlesQty + publicArticlesQty + institutionsArticlesQty;
        const overallBeneficiaries =
          districtArticlesQty + publicArticlesQty + institutionsApplications.size;
        const overallValueAccrued =
          districtValueAccrued + publicValueAccrued + institutionsValueAccrued;

        let fundRequestTotalValue = 0;
        fundRequestEntries.forEach((entry) => {
          fundRequestTotalValue += Number(entry.total_amount || 0);
        });

        const pendingDistricts = districtMaster
          .filter((district) => district.id && !districtIds.has(district.id))
          .map((district) => district.district_name)
          .filter(Boolean);

        const totalAllottedFund = districtMaster.reduce(
          (sum, district) => sum + Number(district.allotted_budget || 0),
          0
        );

        const districtSpendMap = new Map<string, number>();
        districtEntries.forEach((entry) => {
          if (!entry.district_id) return;
          const current = districtSpendMap.get(entry.district_id) || 0;
          districtSpendMap.set(entry.district_id, current + Number(entry.total_amount || 0));
        });

        const districtUtilization = districtMaster
          .map((district) => {
            const allotted = Number(district.allotted_budget || 0);
            const used = districtSpendMap.get(district.id) || 0;
            const remaining = Math.max(allotted - used, 0);
            const utilizationPct = allotted > 0 ? Math.min((used / allotted) * 100, 100) : 0;
            return {
              id: district.id,
              name: district.district_name,
              allotted,
              used,
              remaining,
              utilizationPct,
            };
          })
          .filter((district) => district.name)
          .sort((a, b) => b.utilizationPct - a.utilizationPct);

        const computedMetrics: DashboardMetrics = {
          district: {
            districtsReceived: districtIds.size,
            districtsPending: Math.max(totalDistricts - districtIds.size, 0),
            totalArticlesQty: districtArticlesQty,
            uniqueArticles: districtArticleIds.size,
            totalBeneficiaries: districtEntries.length,
            totalAllottedFund,
            totalValueAccrued: districtValueAccrued,
          },
          districtUtilization,
          public: {
            totalBeneficiaries: publicEntries.length,
            totalArticlesQty: publicArticlesQty,
            uniqueArticles: publicArticleIds.size,
            totalValueAccrued: publicValueAccrued,
            gender: genderCounts,
            femaleStatus: femaleStatusCounts,
            handicapped,
          },
          institutions: {
            totalBeneficiaries: institutionsEntries.length,
            applicationCount: institutionsApplications.size,
            totalArticlesQty: institutionsArticlesQty,
            uniqueArticles: institutionsArticleIds.size,
            totalValueAccrued: institutionsValueAccrued,
          },
          overall: {
            totalBeneficiaries: overallBeneficiaries,
            totalArticlesQty: overallArticlesQty,
            uniqueArticles: overallArticleIds.size,
            totalValueAccrued: overallValueAccrued,
          },
          fundRequests: {
            count: fundRequestResult.count || 0,
            totalValue: fundRequestTotalValue,
          },
          totalDistricts,
          pendingDistricts,
        };

        if (isMounted) {
          setMetrics(computedMetrics);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load dashboard metrics.');
        }
        console.error('Dashboard metrics error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMetrics();
    return () => {
      isMounted = false;
    };
  }, []);

  const renderValue = (value: number) => numberFormat.format(value);
  const renderCurrency = (value: number) => `Rs. ${currencyFormat.format(value)}`;

  return (
    <div className="dashboard-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Space+Grotesk:wght@400;500;600&display=swap');

        .dashboard-root {
          min-height: 100vh;
          background:
            radial-gradient(1200px 600px at 10% -10%, rgba(255, 228, 196, 0.65), transparent 60%),
            radial-gradient(900px 500px at 90% 0%, rgba(177, 232, 255, 0.6), transparent 55%),
            linear-gradient(180deg, #f7f5f0 0%, #f2f4f8 100%);
          padding: 32px 24px 80px;
          color: #1b1b1f;
          font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
        }

        .dashboard-shell {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .hero {
          background: #ffffff;
          border-radius: 24px;
          padding: 28px 28px 24px;
          box-shadow: 0 24px 60px rgba(27, 27, 31, 0.08);
          border: 1px solid rgba(0, 0, 0, 0.05);
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          align-items: center;
        }

        .hero-title {
          font-family: 'Fraunces', serif;
          font-size: 30px;
          font-weight: 700;
          margin: 0 0 8px;
          letter-spacing: 0.2px;
        }

        .hero-sub {
          color: #4a4f5a;
          font-size: 14px;
          line-height: 1.6;
        }

        .hero-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(26, 102, 255, 0.1);
          color: #1a3f8a;
          font-size: 12px;
          font-weight: 600;
          margin-top: 12px;
        }

        .hero-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .hero-card {
          background: linear-gradient(135deg, #f6d7c9, #fde8c8);
          color: #3c2d21;
          border-radius: 18px;
          padding: 16px;
          position: relative;
          overflow: hidden;
          min-height: 96px;
        }

        .hero-card::after {
          content: '';
          position: absolute;
          inset: auto -20% -40% auto;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(255, 255, 255, 0.35), transparent 70%);
        }

        .hero-card-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.7;
        }

        .hero-card-value {
          font-size: 22px;
          font-weight: 600;
          margin-top: 6px;
        }

        .section {
          background: rgba(255, 255, 255, 0.9);
          border-radius: 22px;
          padding: 22px;
          border: 1px solid rgba(0, 0, 0, 0.04);
          box-shadow: 0 10px 24px rgba(27, 27, 31, 0.06);
        }

        .section-title {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-title span {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #1a66ff;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .stat-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          min-height: 90px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .stat-card.list-card {
          min-height: unset;
        }

        .pending-dropdown {
          margin-top: 10px;
          border: 1px solid rgba(26, 102, 255, 0.2);
          border-radius: 12px;
          background: rgba(26, 102, 255, 0.06);
          padding: 6px 10px;
        }

        .pending-dropdown summary {
          list-style: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #1a2f63;
          padding: 4px 2px;
        }

        .pending-dropdown summary::-webkit-details-marker {
          display: none;
        }

        .pending-dropdown summary::after {
          content: '▾';
          font-size: 12px;
          opacity: 0.8;
          transition: transform 0.2s ease;
        }

        .pending-dropdown[open] summary::after {
          transform: rotate(180deg);
        }

        .pending-list {
          margin-top: 8px;
          max-height: 180px;
          overflow-y: auto;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.7);
          padding: 6px;
        }

        .pending-item {
          padding: 6px 10px;
          font-size: 13px;
          color: #1a2f63;
          border-radius: 8px;
        }

        .pending-item:nth-child(odd) {
          background: rgba(26, 102, 255, 0.06);
        }

        .pending-empty {
          font-size: 12px;
          color: #6a6f7a;
          margin-top: 6px;
        }


        .stat-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.9px;
          color: #6a6f7a;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: #1b1b1f;
          margin-top: 8px;
          line-height: 1.2;
        }

        .stat-muted {
          font-size: 12px;
          color: #8b909a;
          margin-top: 6px;
        }

        .stat-lines {
          margin-top: 8px;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        }

        .stat-line {
          display: grid;
          gap: 2px;
        }

        .stat-line-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #6a6f7a;
          font-weight: 600;
        }

        .stat-line-value {
          font-size: 18px;
          font-weight: 700;
          color: #1b1b1f;
        }

        .stat-line.gender-male .stat-line-value {
          color: #1d4ed8;
        }

        .stat-line.gender-female .stat-line-value {
          color: #db2777;
        }

        .stat-line.gender-transgender .stat-line-value {
          color: #7c3aed;
        }

        .stat-line.female-unmarried .stat-line-value {
          color: #0ea5e9;
        }

        .stat-line.female-married .stat-line-value {
          color: #f97316;
        }

        .stat-line.female-widow .stat-line-value {
          color: #64748b;
        }

        .stat-line.female-single-mother .stat-line-value {
          color: #10b981;
        }

        .total-strip {
          background: linear-gradient(120deg, #1a66ff, #7c3aed);
          color: #fff;
          border-radius: 20px;
          padding: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          align-items: center;
        }

        .total-strip .stat-card {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .total-strip .stat-label {
          color: rgba(255, 255, 255, 0.7);
        }

        .total-strip .stat-value {
          color: #fff;
        }

        .loading-card,
        .error-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .error-card {
          border-color: rgba(220, 38, 38, 0.4);
          color: #b91c1c;
        }

        @media (max-width: 768px) {
          .hero {
            padding: 22px;
          }

          .hero-stats {
            grid-template-columns: 1fr;
          }

          .dashboard-root {
            padding: 24px 16px 64px;
          }
        }
      `}</style>
      <div className="dashboard-shell">
        <div className="hero">
          <div>
            <h1 className="hero-title">Makkal Nala Pani 2026</h1>
            <p className="hero-sub">
              Welcome back, {user?.name || user?.email || 'User'}.
            </p>
            <div className="hero-chip">All-time metrics • Live snapshot</div>
          </div>
          <div className="hero-stats">
            <div className="hero-card">
              <div className="hero-card-title">Total Value Accrued</div>
              <div className="hero-card-value">
                {metrics ? renderCurrency(metrics.overall.totalValueAccrued) : '—'}
              </div>
            </div>
            <div className="hero-card" style={{ background: '#f59fba', color: '#2d0c1a' }}>
              <div className="hero-card-title">Total Fund Raised</div>
              <div className="hero-card-value">
                {metrics ? renderCurrency(metrics.fundRequests.totalValue) : '—'}
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="loading-card">
            <p>Loading metrics...</p>
          </div>
        )}

        {error && !loading && (
          <div className="error-card">
            <p>{error}</p>
          </div>
        )}

        {metrics && !loading && !error && (
          <>
            <div className="section">
              <h2 className="section-title">
                <span /> District
              </h2>
              <div className="stat-grid">
                <StatCard title="Districts Received" value={renderValue(metrics.district.districtsReceived)} />
                <StatCard title="Districts Pending" value={renderValue(metrics.district.districtsPending)} />
                <StatCard
                  title="Articles"
                  value={renderValue(metrics.district.uniqueArticles)}
                />
                <StatCard
                  title="Total Beneficiaries"
                  value={renderValue(metrics.district.totalArticlesQty)}
                />
                <StatCard title="Total Allotted Fund" value={renderCurrency(metrics.district.totalAllottedFund)} />
                <StatCard title="Total Value Accrued" value={renderCurrency(metrics.district.totalValueAccrued)} />
              </div>
              <div className="stat-grid" style={{ marginTop: 16 }}>
                <div className="stat-card list-card">
                  <div className="stat-label">Pending Districts (Names)</div>
                  {metrics.pendingDistricts.length ? (
                    <details className="pending-dropdown">
                      <summary>{`Show pending districts (${metrics.pendingDistricts.length})`}</summary>
                      <div className="pending-list" role="listbox" aria-label="Pending district list">
                        {metrics.pendingDistricts.map((name) => (
                          <div key={name} className="pending-item" role="option">
                            {name}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <div className="pending-empty">None</div>
                  )}
                </div>
              </div>
            </div>


            <div className="section">
              <h2 className="section-title">
                <span /> Public
              </h2>
              <div className="stat-grid">
                <StatCard title="Beneficiaries" value={renderValue(metrics.public.totalBeneficiaries)} />
                <StatListCard
                  title="Gender Split"
                  items={[
                    { label: 'Male', value: renderValue(metrics.public.gender.male), className: 'gender-male' },
                    { label: 'Female', value: renderValue(metrics.public.gender.female), className: 'gender-female' },
                    { label: 'Transgender', value: renderValue(metrics.public.gender.transgender), className: 'gender-transgender' },
                  ]}
                />
                <StatListCard
                  title="Female Status"
                  items={[
                    { label: 'Unmarried', value: renderValue(metrics.public.femaleStatus.unmarried), className: 'female-unmarried' },
                    { label: 'Married', value: renderValue(metrics.public.femaleStatus.married), className: 'female-married' },
                    { label: 'Widow', value: renderValue(metrics.public.femaleStatus.widow), className: 'female-widow' },
                    { label: 'Single Mother', value: renderValue(metrics.public.femaleStatus.singleMother), className: 'female-single-mother' },
                  ]}
                />
                <StatCard title="Total Handicapped" value={renderValue(metrics.public.handicapped)} />
                <StatCard
                  title="Articles"
                  value={renderValue(metrics.public.uniqueArticles)}
                />
                <StatCard title="Total Value Accrued" value={renderCurrency(metrics.public.totalValueAccrued)} />
              </div>
            </div>

            <div className="section">
              <h2 className="section-title">
                <span /> Institution & Others
              </h2>
              <div className="stat-grid">
                <StatCard
                  title="Beneficiaries"
                  value={renderValue(metrics.institutions.applicationCount)}
                />
                <StatCard
                  title="Articles"
                  value={renderValue(metrics.institutions.uniqueArticles)}
                />
                <StatCard
                  title="Total Article Quantity"
                  value={renderValue(metrics.institutions.totalArticlesQty)}
                />
                <StatCard
                  title="Total Value Accrued"
                  value={renderCurrency(metrics.institutions.totalValueAccrued)}
                />
              </div>
            </div>

            <div className="section">
              <h2 className="section-title">
                <span /> Fund Requests
              </h2>
              <div className="stat-grid">
                <StatCard title="Fund Request Made" value={renderValue(metrics.fundRequests.count)} />
                <StatCard title="Fund Request Value" value={renderCurrency(metrics.fundRequests.totalValue)} />
              </div>
            </div>

            <div className="total-strip">
                <StatCard title="Total Beneficiaries" value={renderValue(metrics.overall.totalBeneficiaries)} />
                <StatCard
                  title="Total Articles"
                  value={renderValue(metrics.overall.uniqueArticles)}
                />
                <StatCard
                  title="Total Article Quantity"
                  value={renderValue(metrics.overall.totalArticlesQty)}
                />
                <StatCard title="Total Value Accrued" value={renderCurrency(metrics.overall.totalValueAccrued)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="stat-card">
    <div className="stat-label">{title}</div>
    <div className="stat-value">{value}</div>
  </div>
);

const StatListCard: React.FC<{ title: string; items: { label: string; value: string; className?: string }[] }> = ({ title, items }) => (
  <div className="stat-card">
    <div className="stat-label">{title}</div>
    <div className="stat-lines">
      {items.map((item) => (
        <div key={item.label} className={`stat-line ${item.className || ''}`.trim()}>
          <div className="stat-line-label">{item.label}</div>
          <div className="stat-line-value">{item.value}</div>
        </div>
      ))}
    </div>
  </div>
);

export default Dashboard;
