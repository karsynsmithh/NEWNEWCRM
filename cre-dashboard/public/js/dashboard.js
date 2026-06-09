PAGE_LOADERS.dashboard = async function loadDashboard() {
  const el = document.getElementById('page-dashboard');
  el.innerHTML = '<p style="color:var(--text-muted);padding:20px">Loading...</p>';

  const [data, recentActivities] = await Promise.all([
    API.get('/api/dashboard/summary').catch(() => null),
    API.get('/api/activities/recent').catch(() => [])
  ]);
  if (!data) {
    el.innerHTML = '<p style="color:var(--red);padding:20px">Failed to load dashboard.</p>';
    return;
  }

  const goalKey = 'cre_commission_goal';
  const goal = parseFloat(localStorage.getItem(goalKey)) || 100000;
  const ytdPct = Math.min(100, goal > 0 ? (data.commission_ytd / goal) * 100 : 0).toFixed(1);

  const stageOrder = ['prospect', 'loi', 'under_contract'];
  const stageLabels = { prospect: 'Prospect', loi: 'LOI', under_contract: 'Under Contract' };
  const stageMap = {};
  (data.pipeline_by_stage || []).forEach(r => { stageMap[r.stage] = r; });

  const pipelineRows = stageOrder.map(s => {
    const r = stageMap[s] || { count: 0, value: 0 };
    return `<tr>
      <td>${stageLabels[s]}</td>
      <td>${r.count}</td>
      <td>${fmt$(r.value)}</td>
    </tr>`;
  }).join('');

  // Group events by date
  const eventsByDate = {};
  (data.upcoming_events || []).forEach(ev => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });

  const todayStr = today();
  const eventHtml = Object.keys(eventsByDate).sort().map(date => {
    const cls = isOverdue(date) ? 'overdue' : isToday(date) ? 'today' : '';
    const label = isToday(date) ? 'Today' : isOverdue(date) ? `Overdue — ${fmtDate(date)}` : fmtDate(date);
    const items = eventsByDate[date].map(ev => {
      const badgeCls = ev.type === 'followup' ? 'badge-followup' : ev.type === 'loi' ? 'badge-loi' : 'badge-close';
      const typeLabel = ev.type === 'followup' ? 'Follow-up' : ev.type === 'loi' ? 'LOI' : 'Close';
      const href = ev.type === 'followup' ? '#followups' : '#deals';
      return `<div class="event-item ${cls}">
        <span class="event-badge ${badgeCls}">${typeLabel}</span>
        <span class="event-title">${ev.title}</span>
        <a href="${href}" class="event-link" onclick="navigate('${ev.type === 'followup' ? 'followups' : 'deals'}')">View</a>
      </div>`;
    }).join('');
    return `<div class="event-group">
      <div class="event-group-date ${cls}">${label}</div>
      ${items}
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);font-size:13px">No upcoming events in the next 14 days.</p>';

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
    </div>

    <div class="cards-row">
      <div class="card">
        <div class="card-label">Active Listings</div>
        <div class="card-value">${data.active_listings}</div>
      </div>
      <div class="card">
        <div class="card-label">Pipeline Value</div>
        <div class="card-value teal">${fmt$(data.pipeline_value)}</div>
        <div class="card-sub">Expected commissions</div>
      </div>
      <div class="card">
        <div class="card-label">Closing This Month</div>
        <div class="card-value">${data.deals_closing_soon}</div>
        <div class="card-sub">Expected closes in 30d</div>
      </div>
      <div class="card">
        <div class="card-label">Follow-ups Due Today</div>
        <div class="card-value ${data.followups_due_today > 0 ? 'red' : ''}">${data.followups_due_today}</div>
        <div class="card-sub">${data.followups_due_this_week} due this week</div>
      </div>
    </div>

    <div class="panels-row">
      <div class="panel">
        <div class="panel-title">Pipeline by Stage</div>
        <table class="pipeline-table">
          <thead><tr><th>Stage</th><th>Count</th><th>Commission Value</th></tr></thead>
          <tbody>${pipelineRows}</tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-title">Commission Tracker</div>
        <div class="progress-row">
          <span class="progress-label">Received YTD</span>
          <span class="progress-val">${fmt$(data.commission_ytd)}</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${ytdPct}%"></div>
        </div>
        <div class="progress-row">
          <span class="progress-label">Expected (pending/invoiced)</span>
          <span class="progress-val">${fmt$(data.commission_expected)}</span>
        </div>
        <div class="goal-row">
          <label>Annual Goal: $</label>
          <input type="number" id="goal-input" value="${goal}" min="0" step="1000" />
        </div>
      </div>
    </div>

    <div class="events-panel">
      <div class="panel-title" style="margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        Key Dates — Next 14 Days
      </div>
      ${eventHtml}
    </div>

    <div class="panel" style="margin-top:20px">
      <div class="panel-title">Recent Activity</div>
      ${recentActivities.slice(0,5).length === 0
        ? '<p style="color:var(--text-muted);font-size:13px">No activities logged yet.</p>'
        : recentActivities.slice(0,5).map(a => {
            const actBadgeColors = { call:'#dbeafe|#1e40af', email:'#ede9fe|#4c1d95', meeting:'#ccfbf1|#115e59', site_tour:'#ffedd5|#9a3412', loi_sent:'#dcfce7|#14532d', loi_countered:'#dcfce7|#14532d', lease_sent:'#dcfce7|#14532d', lease_executed:'#dcfce7|#14532d', voicemail:'#f1f5f9|#64748b', text:'#f1f5f9|#64748b', other:'#f1f5f9|#64748b' };
            const [bg, color] = (actBadgeColors[a.activity_type] || '#f1f5f9|#64748b').split('|');
            const daysAgo = Math.floor((Date.now() - new Date(a.activity_date).getTime()) / 86400000);
            const ago = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1d ago' : daysAgo + 'd ago';
            return `<div class="recent-act-item">
              <span style="background:${bg};color:${color};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap">${(a.activity_type||'').replace(/_/g,' ')}</span>
              <span class="recent-act-text">${a.summary}${a.contact_name ? ' — ' + a.contact_name : ''}</span>
              <span class="recent-act-meta">${ago}</span>
            </div>`;
          }).join('')}
    </div>
  `;

  document.getElementById('goal-input').addEventListener('change', e => {
    localStorage.setItem(goalKey, e.target.value);
    loadDashboard();
  });
};
