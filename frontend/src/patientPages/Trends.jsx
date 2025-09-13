import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Trends.css';

function TrendCard({ title, current, previous, percentage, unit, compareLabel, precision = 1 }) {
  const isPositive = percentage >= 0;
  const formattedCurrent = typeof current === 'number' ? current.toFixed(precision) : '--';
  const formattedPrevious = typeof previous === 'number' ? previous.toFixed(precision) : '--';
  const formattedPercentage = typeof percentage === 'number' ? Math.abs(percentage).toFixed(1) : '--';

  return (
    <div className="trend-card">
      <h3>{title}</h3>
      <div className="trend-values">
        <div className="current-value">
          <span className="value">{formattedCurrent}</span>
          <span className="unit">{unit}</span>
        </div>
        <div className="comparison">
          <div className="previous-value">
            {compareLabel}: {formattedPrevious} {unit}
          </div>
          <div className={`trend-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '↗' : '↘'} {formattedPercentage}%
          </div>
        </div>
      </div>
    </div>
  );
}

function Trends() {
  const [dailyTrends, setDailyTrends] = useState(null);
  const [weeklyTrends, setWeeklyTrends] = useState(null);
  const [monthlyTrends, setMonthlyTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/trends', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trends');
      }

      const data = await response.json();
      setDailyTrends(data.daily);
      setWeeklyTrends(data.weekly);
      setMonthlyTrends(data.monthly);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeData = (value, type) => {
    if (!value) return 0;
    switch (type) {
      case 'spo2': return value;
      case 'sleep': return value * 10; // Scale for chart visibility
      case 'calories': return value / 50; // Scale down for chart
      case 'temperature': return value; // Remove scaling - show actual temperature
      default: return value;
    }
  };

  if (loading) return <div className="trends-loading">Loading trends...</div>;
  if (error) return <div className="trends-error">Error: {error}</div>;

  const dailyComparisonData = [
    {
      name: 'SpO2',
      Today: normalizeData(dailyTrends.spo2_current, 'spo2'),
      Yesterday: normalizeData(dailyTrends.spo2_previous, 'spo2')
    },
    {
      name: 'Heart Rate',
      Today: dailyTrends.heart_rate_current,
      Yesterday: dailyTrends.heart_rate_previous
    },
    {
      name: 'Respiratory',
      Today: dailyTrends.respiratory_rate_current,
      Yesterday: dailyTrends.respiratory_rate_previous
    },
    {
      name: 'Sleep',
      Today: normalizeData(dailyTrends.sleep_current, 'sleep'),
      Yesterday: normalizeData(dailyTrends.sleep_previous, 'sleep')
    },
    {
      name: 'Calories',
      Today: normalizeData(dailyTrends.calories_current, 'calories'),
      Yesterday: normalizeData(dailyTrends.calories_previous, 'calories')
    },
    {
      name: 'Temperature',
      Today: normalizeData(dailyTrends.temperature_current, 'temperature'),
      Yesterday: normalizeData(dailyTrends.temperature_previous, 'temperature')
    }
  ];

  return (
    <div className="trends-container">
      <h1>Health Trends</h1>

      {/* Daily Trends */}
      <div className="trends-section">
        <h2>Daily Trends</h2>
        <div className="trends-grid">
          <TrendCard
            title="Blood Oxygen"
            current={dailyTrends.spo2_current}
            previous={dailyTrends.spo2_previous}
            percentage={dailyTrends.spo2_pct_change}
            unit="%"
            compareLabel="Yesterday"
          />
          <TrendCard
            title="Heart Rate"
            current={dailyTrends.heart_rate_current}
            previous={dailyTrends.heart_rate_previous}
            percentage={dailyTrends.heart_rate_pct_change}
            unit="bpm"
            compareLabel="Yesterday"
          />
          <TrendCard
            title="Respiratory Rate"
            current={dailyTrends.respiratory_rate_current}
            previous={dailyTrends.respiratory_rate_previous}
            percentage={dailyTrends.respiratory_rate_pct_change}
            unit="rpm"
            compareLabel="Yesterday"
          />
          <TrendCard
            title="Sleep Duration"
            current={dailyTrends.sleep_current}
            previous={dailyTrends.sleep_previous}
            percentage={dailyTrends.sleep_pct_change}
            unit="hours"
            compareLabel="Yesterday"
          />
          <TrendCard
            title="Active Calories"
            current={dailyTrends.calories_current}
            previous={dailyTrends.calories_previous}
            percentage={dailyTrends.calories_pct_change}
            unit="kcal"
            compareLabel="Yesterday"
          />
          <TrendCard
            title="Wrist Temperature"
            current={dailyTrends.temperature_current}
            previous={dailyTrends.temperature_previous}
            percentage={dailyTrends.temperature_pct_change}
            unit="°C"
            compareLabel="Yesterday"
            precision={2}
          />
        </div>
        
        <div className="daily-comparison-chart">
          <h3>Daily Comparison</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dailyComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis 
                dataKey="name" 
                stroke="rgba(255, 255, 255, 0.7)"
                fontSize={12}
              />
              <YAxis stroke="rgba(255, 255, 255, 0.7)" fontSize={12} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(0, 251, 205, 0.3)',
                  borderRadius: '8px',
                  color: 'white'
                }}
                cursor={false}
              />
              <Legend />
              <Bar dataKey="Today" fill="#00fbcd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Yesterday" fill="rgba(255, 223, 87, 0.8)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Trends */}
      <div className="trends-section">
        <h2>Weekly Trends</h2>
        <div className="trends-grid">
          <TrendCard
            title="Blood Oxygen"
            current={weeklyTrends.spo2_current}
            previous={weeklyTrends.spo2_previous}
            percentage={weeklyTrends.spo2_pct_change}
            unit="%"
            compareLabel="Last Week"
          />
          <TrendCard
            title="Heart Rate"
            current={weeklyTrends.heart_rate_current}
            previous={weeklyTrends.heart_rate_previous}
            percentage={weeklyTrends.heart_rate_pct_change}
            unit="bpm"
            compareLabel="Last Week"
          />
          <TrendCard
            title="Respiratory Rate"
            current={weeklyTrends.respiratory_rate_current}
            previous={weeklyTrends.respiratory_rate_previous}
            percentage={weeklyTrends.respiratory_rate_pct_change}
            unit="rpm"
            compareLabel="Last Week"
          />
          <TrendCard
            title="Sleep Duration"
            current={weeklyTrends.sleep_current}
            previous={weeklyTrends.sleep_previous}
            percentage={weeklyTrends.sleep_pct_change}
            unit="hours"
            compareLabel="Last Week"
          />
          <TrendCard
            title="Active Calories"
            current={weeklyTrends.calories_current}
            previous={weeklyTrends.calories_previous}
            percentage={weeklyTrends.calories_pct_change}
            unit="kcal"
            compareLabel="Last Week"
          />
          <TrendCard
            title="Wrist Temperature"
            current={weeklyTrends.temperature_current}
            previous={weeklyTrends.temperature_previous}
            percentage={weeklyTrends.temperature_pct_change}
            unit="°C"
            compareLabel="Last Week"
            precision={2}
          />
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="trends-section">
        <h2>Monthly Trends</h2>
        <div className="trends-grid">
          <TrendCard
            title="Blood Oxygen"
            current={monthlyTrends.spo2_current}
            previous={monthlyTrends.spo2_previous}
            percentage={monthlyTrends.spo2_pct_change}
            unit="%"
            compareLabel="Last Month"
          />
          <TrendCard
            title="Heart Rate"
            current={monthlyTrends.heart_rate_current}
            previous={monthlyTrends.heart_rate_previous}
            percentage={monthlyTrends.heart_rate_pct_change}
            unit="bpm"
            compareLabel="Last Month"
          />
          <TrendCard
            title="Respiratory Rate"
            current={monthlyTrends.respiratory_rate_current}
            previous={monthlyTrends.respiratory_rate_previous}
            percentage={monthlyTrends.respiratory_rate_pct_change}
            unit="rpm"
            compareLabel="Last Month"
          />
          <TrendCard
            title="Sleep Duration"
            current={monthlyTrends.sleep_current}
            previous={monthlyTrends.sleep_previous}
            percentage={monthlyTrends.sleep_pct_change}
            unit="hours"
            compareLabel="Last Month"
          />
          <TrendCard
            title="Active Calories"
            current={monthlyTrends.calories_current}
            previous={monthlyTrends.calories_previous}
            percentage={monthlyTrends.calories_pct_change}
            unit="kcal"
            compareLabel="Last Month"
          />
          <TrendCard
            title="Wrist Temperature"
            current={monthlyTrends.temperature_current}
            previous={monthlyTrends.temperature_previous}
            percentage={monthlyTrends.temperature_pct_change}
            unit="°C"
            compareLabel="Last Month"
            precision={2}
          />
        </div>
      </div>
    </div>
  );
}

export default Trends;
