'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import PriorityModal from './PriorityModal';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface EmailStats {
  totalEmails: number;
  emailsSent: number;
  emailsNotSent: number;
  emails5DaysFollowup: number;
  emails10DaysFollowup: number;
  emailsReplied: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  loading: boolean;
  error: string | null;
}

export default function EmailStatsDashboard() {
  const [stats, setStats] = useState<EmailStats>({
    totalEmails: 0,
    emailsSent: 0,
    emailsNotSent: 0,
    emails5DaysFollowup: 0,
    emails10DaysFollowup: 0,
    emailsReplied: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    loading: true,
    error: null
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<'High Priority' | 'Medium Priority' | 'Low Priority' | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchEmailStats();
  }, []);

  const fetchEmailStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      // Fetch all data from Supabase in chunks to bypass 1000 row limit
      let allFoundersData: any[] = [];
      let from = 0;
      const step = 1000;
      let fetchMore = true;

      while (fetchMore) {
        const { data: chunk, error: chunkError } = await supabase
          .from('scraped_data')
          .select('*')
          .range(from, from + step - 1);

        if (chunkError) throw chunkError;

        if (chunk && chunk.length > 0) {
          allFoundersData = [...allFoundersData, ...chunk];
          from += step;
          if (chunk.length < step) {
            fetchMore = false;
          }
        } else {
          fetchMore = false;
        }
      }

      const foundersData = allFoundersData;

      if (!foundersData) {
        throw new Error('No data received from database');
      }

      // Calculate statistics from real data
      const totalEmails = foundersData.length;

      // Robust check for sent emails - Cumulative Count
      // Includes: Status 'sent', 'followup', 'reply', OR boolean flags for followups
      const emailsSent = foundersData.filter((f: any) => {
        const status = f.mail_status?.toLowerCase() || '';

        // Check status string
        const statusIndicatesSent =
          status === 'sent' ||
          status === 'email_sent' ||
          status.includes('sent') ||
          status.includes('followup') ||
          status.includes('reply'); // If they replied, we must have sent an email

        // Check boolean flags (if status is missing or weird, these are sources of truth)
        const flagsIndicateSent =
          f.followup_5_sent === true ||
          f.followup_10_sent === true;

        // Check reply content
        const replyIndicatesSent =
          f.mail_replies &&
          typeof f.mail_replies === 'string' &&
          f.mail_replies.trim() !== '' &&
          f.mail_replies.toLowerCase() !== 'no reply' &&
          f.mail_replies.toLowerCase() !== 'no_reply';

        return statusIndicatesSent || flagsIndicateSent || replyIndicatesSent;
      }).length;

      const emailsNotSent = totalEmails - emailsSent;

      // Count follow-ups (using the boolean fields)
      const emails5DaysFollowup = foundersData.filter((f: any) => f.followup_5_sent === true).length;
      const emails10DaysFollowup = foundersData.filter((f: any) => f.followup_10_sent === true).length;

      // Count replies (check if mail_replies field has content and is not 'no reply')
      const emailsReplied = foundersData.filter((f: any) => {
        const reply = f.mail_replies;
        return reply &&
          typeof reply === 'string' &&
          reply.trim() !== '' &&
          reply.toLowerCase() !== 'no reply' &&
          reply.toLowerCase() !== 'no_reply';
      }).length;

      // Count priorities based on reply_priority field
      const highPriority = foundersData.filter((f: any) => f.reply_priority === 'High Priority').length;
      const mediumPriority = foundersData.filter((f: any) => f.reply_priority === 'Medium Priority').length;
      const lowPriority = foundersData.filter((f: any) => f.reply_priority === 'Low Priority').length;

      setStats({
        totalEmails,
        emailsSent,
        emailsNotSent,
        emails5DaysFollowup,
        emails10DaysFollowup,
        emailsReplied,
        highPriority,
        mediumPriority,
        lowPriority,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('❌ Error fetching email stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics'
      }));
    }
  };

  // State for email date data
  const [emailDateData, setEmailDateData] = useState<any[]>([]);
  const [isLoadingDateData, setIsLoadingDateData] = useState(false);

  // Fetch email data by date whenever selected month changes
  useEffect(() => {
    fetchEmailDataByDate();
  }, [selectedMonth]);

  // Fetch date-based email data from Supabase
  const fetchEmailDataByDate = async () => {
    try {
      setIsLoadingDateData(true);
      const [year, month] = selectedMonth.split('-').map(Number);

      // Calculate start and end dates for the selected month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Fetch all emails created in the selected month
      // We fetch mail_status and flags to filter in JS
      // Use a high limit to ensure we get all data for the month (unlikely to exceed 10k per month)
      const { data: emailsData, error: fetchError } = await supabase
        .from('scraped_data')
        .select('created_at, mail_status, followup_5_sent, followup_10_sent, mail_replies')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .limit(10000); // Increase limit to ensure we get all data for the month

      if (fetchError) {
        console.error('Error fetching email date data:', fetchError);
        // Fall back to empty data
        setEmailDateData([]);
        setIsLoadingDateData(false);
        return;
      }

      // Group emails by date
      const daysInMonth = new Date(year, month, 0).getDate();
      const emailCountsByDate: { [key: string]: number } = {};

      // Initialize all days with 0
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateKey = date.toISOString().split('T')[0];
        emailCountsByDate[dateKey] = 0;
      }

      // Count emails for each day
      if (emailsData) {
        emailsData.forEach((email: any) => {
          // Check if email is sent using robust cumulative logic
          const status = email.mail_status?.toLowerCase() || '';

          const statusIndicatesSent =
            status === 'sent' ||
            status === 'email_sent' ||
            status.includes('sent') ||
            status.includes('followup') ||
            status.includes('reply');

          const flagsIndicateSent =
            email.followup_5_sent === true ||
            email.followup_10_sent === true;

          const replyIndicatesSent =
            email.mail_replies &&
            typeof email.mail_replies === 'string' &&
            email.mail_replies.trim() !== '' &&
            email.mail_replies.toLowerCase() !== 'no reply' &&
            email.mail_replies.toLowerCase() !== 'no_reply';

          const isSent = statusIndicatesSent || flagsIndicateSent || replyIndicatesSent;

          if (isSent) {
            const emailDate = new Date(email.created_at);
            const dateKey = emailDate.toISOString().split('T')[0];
            if (emailCountsByDate.hasOwnProperty(dateKey)) {
              emailCountsByDate[dateKey]++;
            }
          }
        });
      }

      // Determine date range to display
      // If current month, show only past 5 days to avoid empty gap
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const isCurrentMonth = year === currentYear && month === currentMonth;

      let startDay = 1;
      let endDay = daysInMonth;

      if (isCurrentMonth) {
        const currentDay = now.getDate();
        startDay = Math.max(1, currentDay - 4); // Show past 5 days (including today)
        endDay = currentDay;
      }

      // Convert to array format for chart
      const chartData = [];
      for (let day = startDay; day <= endDay; day++) {
        const date = new Date(year, month - 1, day);
        const dateKey = date.toISOString().split('T')[0];
        chartData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: dateKey,
          emailsSent: emailCountsByDate[dateKey] || 0,
          day: day
        });
      }

      setEmailDateData(chartData);
      setIsLoadingDateData(false);
    } catch (error) {
      console.error('Error processing email date data:', error);
      setEmailDateData([]);
      setIsLoadingDateData(false);
    }
  };

  // Prepare data for charts
  const replyStatusData = [
    { name: 'Replied', value: stats.emailsReplied, color: '#8B5CF6' },
    { name: 'Not Replied', value: stats.emailsSent - stats.emailsReplied, color: '#94A3B8' }
  ];

  // Get available months for dropdown (starting from November 2025)
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();

    // Start from November 2025
    const startYear = 2025;
    const startMonth = 10; // 0-indexed (November)

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let iterYear = startYear;
    let iterMonth = startMonth;

    while (iterYear < currentYear || (iterYear === currentYear && iterMonth <= currentMonth)) {
      const date = new Date(iterYear, iterMonth, 1);
      const yearStr = date.getFullYear();
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      months.push({ value: `${yearStr}-${monthStr}`, label: monthName });

      // Increment
      iterMonth++;
      if (iterMonth > 11) {
        iterMonth = 0;
        iterYear++;
      }
    }

    // Fallback if current date is before start date (shouldn't happen based on requirements, but good for safety)
    if (months.length === 0) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      months.push({ value: `${year}-${month}`, label: monthName });
    }

    return months;
  };

  const availableMonths = getAvailableMonths();

  // Custom label for pie charts
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-semibold"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  if (stats.loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600 text-lg">Loading email statistics...</span>
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Statistics</h3>
          <p className="text-gray-600 mb-6">{stats.error}</p>
          <button
            onClick={fetchEmailStats}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Key Metrics Cards - Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Emails */}
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-blue-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Emails</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalEmails.toLocaleString()}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Emails Sent */}
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-green-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Emails Sent</p>
              <p className="text-3xl font-bold text-gray-900">{stats.emailsSent.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Emails Not Sent */}
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-red-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Emails Not Sent</p>
              <p className="text-3xl font-bold text-gray-900">{stats.emailsNotSent.toLocaleString()}</p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 5 Days Followup */}
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-orange-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">5 Days Followup</p>
              <p className="text-3xl font-bold text-gray-900">{stats.emails5DaysFollowup.toLocaleString()}</p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 10 Days Followup */}
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-gray-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">10 Days Followup</p>
              <p className="text-3xl font-bold text-gray-900">{stats.emails10DaysFollowup.toLocaleString()}</p>
            </div>
            <div className="bg-gray-100 rounded-full p-3">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Emails Replied */}
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-purple-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Emails Replied</p>
              <p className="text-3xl font-bold text-gray-900">{stats.emailsReplied.toLocaleString()}</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Chart for Emails Sent by Date */}
      <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Email Performance Rates</h3>
          <div className="flex items-center gap-3">
            <label htmlFor="month-select" className="text-sm font-medium text-gray-700">
              Select Month:
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-black bg-white"
            >
              {availableMonths.map((month) => (
                <option key={month.value} value={month.value} className="text-black">
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isLoadingDateData ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-gray-600">Loading chart data...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={emailDateData}
              margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={Math.floor(emailDateData.length / 10)} // Show ~10 labels
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ value: 'Emails Sent', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [`${value} emails`, 'Emails Sent']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Bar
                dataKey="emailsSent"
                fill="#3B82F6"
                name="Emails Sent"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-700">Total Emails Sent in {availableMonths.find(m => m.value === selectedMonth)?.label}:</p>
            <p className="text-lg font-bold text-blue-600 mt-1">
              {emailDateData.reduce((sum, day) => sum + day.emailsSent, 0).toLocaleString()} emails
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-600">Average per day:</p>
            <p className="text-lg font-bold text-gray-900">
              {emailDateData.length > 0
                ? Math.round(emailDateData.reduce((sum, day) => sum + day.emailsSent, 0) / emailDateData.length)
                : 0} emails/day
            </p>
          </div>
        </div>
      </div>

      {/* Reply Status Pie Chart */}
      <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Reply Status (Sent Emails)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={replyStatusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {replyStatusData.map((entry: any, index: any) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()} emails`, '']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => {
                const data = replyStatusData.find((d: any) => d.name === value);
                const percentage = stats.emailsSent > 0 ? ((data?.value || 0) / stats.emailsSent * 100).toFixed(1) : '0.0';
                return `${value}: ${data?.value.toLocaleString() || 0} (${percentage}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Total Sent: {stats.emailsSent.toLocaleString()} emails</p>
          <p className="mt-1">
            Replied: {stats.emailsReplied.toLocaleString()} ({stats.emailsSent > 0 ? ((stats.emailsReplied / stats.emailsSent) * 100).toFixed(1) : 0}%) |
            Not Replied: {(stats.emailsSent - stats.emailsReplied).toLocaleString()} ({stats.emailsSent > 0 ? (((stats.emailsSent - stats.emailsReplied) / stats.emailsSent) * 100).toFixed(1) : 0}%)
          </p>
        </div>
      </div>

      {/* Mail Priority - Horizontal Layout */}
      <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Mail Priority</h3>
          <div className="bg-blue-100 rounded-full p-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="flex items-center justify-between p-4 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors border-l-4 border-green-500"
            onClick={() => {
              setSelectedPriority('High Priority');
              setIsModalOpen(true);
            }}
          >
            <div>
              <p className="text-sm font-medium text-gray-600">High Priority</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.highPriority}</p>
            </div>
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div
            className="flex items-center justify-between p-4 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors border-l-4 border-orange-500"
            onClick={() => {
              setSelectedPriority('Medium Priority');
              setIsModalOpen(true);
            }}
          >
            <div>
              <p className="text-sm font-medium text-gray-600">Medium Priority</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{stats.mediumPriority}</p>
            </div>
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div
            className="flex items-center justify-between p-4 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors border-l-4 border-red-500"
            onClick={() => {
              setSelectedPriority('Low Priority');
              setIsModalOpen(true);
            }}
          >
            <div>
              <p className="text-sm font-medium text-gray-600">Low Priority</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.lowPriority}</p>
            </div>
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Priority Modal */}
      <PriorityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPriority(null);
        }}
        priority={selectedPriority}
      />

      {/* Summary Footer */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-md p-4 border border-blue-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Total Contacts:</span>
            <span className="text-sm font-bold text-gray-900">{stats.totalEmails.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Successfully Sent:</span>
            <span className="text-sm font-bold text-green-600">{stats.emailsSent.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">5 Days Followup:</span>
            <span className="text-sm font-bold text-orange-600">{stats.emails5DaysFollowup.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">10 Days Followup:</span>
            <span className="text-sm font-bold text-gray-600">{stats.emails10DaysFollowup.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Received Replies:</span>
            <span className="text-sm font-bold text-purple-600">{stats.emailsReplied.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
