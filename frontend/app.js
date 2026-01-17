// API Base URL
const API_BASE = '/api';

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.section');

// Navigation
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const sectionId = btn.dataset.section;
        
        // Update active nav button
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show corresponding section
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(sectionId).classList.add('active');
        
        // Load section data
        loadSectionData(sectionId);
    });
});

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// API Helper
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}: Request failed`);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        // Re-throw with more context
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Make sure Docker containers are running.');
        }
        throw error;
    }
}

// Load section-specific data
function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'submit-project':
            loadParticipantsForProject();
            loadSubmissions();
            break;
        case 'register-event':
            loadEventsForRegistration();
            loadRegistrations();
            break;
        case 'analytics-s1':
            loadSubmissionAnalytics();
            break;
        case 'analytics-s2':
            loadRegistrationAnalytics();
            break;
        case 'data-management':
            loadDbStats();
            break;
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
        // Load summary stats
        const summary = await apiCall('/analytics/summary');
        
        document.getElementById('stat-events').textContent = summary.stats.totalEvents;
        document.getElementById('stat-participants').textContent = summary.stats.totalParticipants;
        document.getElementById('stat-submissions').textContent = summary.stats.totalSubmissions;
        document.getElementById('stat-registrations').textContent = summary.stats.totalRegistrations;
        
        // Recent submissions
        const recentHtml = summary.recentSubmissions.length > 0 
            ? `<table class="data-table">
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Team</th>
                        <th>Submitted</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.recentSubmissions.map(s => `
                        <tr>
                            <td>${s.project_name}</td>
                            <td>${s.team || 'N/A'}</td>
                            <td>${new Date(s.submission_time).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
               </table>`
            : '<p class="empty-state">No submissions yet</p>';
        
        document.getElementById('recent-submissions').innerHTML = recentHtml;
        
        // Health check
        const health = await apiCall('/health');
        document.getElementById('health-status').innerHTML = `
            <p><span class="badge badge-success">MySQL: ${health.mysql}</span></p>
            <p><span class="badge badge-success">MongoDB: ${health.mongodb}</span></p>
        `;
        
    } catch (error) {
        showToast('Failed to load dashboard data', 'error');
        document.getElementById('health-status').innerHTML = `
            <p><span class="badge badge-error">Error: ${error.message}</span></p>
        `;
    }
}

// ==================== SUBMIT PROJECT (Student 1) ====================

async function loadParticipantsForProject() {
    try {
        const data = await apiCall('/submissions/participants');
        
        const listHtml = data.data.map(p => `
            <div class="checkbox-item">
                <input type="checkbox" id="team-${p.person_id}" value="${p.person_id}">
                <label for="team-${p.person_id}">${p.first_name} ${p.last_name} (${p.email})</label>
            </div>
        `).join('');
        
        document.getElementById('team-members-list').innerHTML = listHtml || '<p>No participants available</p>';
        
    } catch (error) {
        document.getElementById('team-members-list').innerHTML = '<p>Failed to load participants</p>';
    }
}

async function loadSubmissions() {
    try {
        const data = await apiCall('/submissions');
        
        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Project Name</th>
                            <th>Team Members</th>
                            <th>Technology Stack</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(s => `
                            <tr>
                                <td>${s.submission_id}</td>
                                <td>${s.project_name}</td>
                                <td>${s.team_members || 'N/A'}</td>
                                <td>${s.technology_stack || 'N/A'}</td>
                                <td>${new Date(s.submission_time).toLocaleString()}</td>
                                <td>
                                    <button class="btn btn-danger btn-sm" onclick="deleteSubmission(${s.submission_id})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No submissions yet. Submit your first project!</p>';
        
        document.getElementById('submissions-list').innerHTML = tableHtml;
        
    } catch (error) {
        document.getElementById('submissions-list').innerHTML = '<p>Failed to load submissions</p>';
    }
}

// Submit Project Form Handler
document.getElementById('submit-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const teamCheckboxes = document.querySelectorAll('#team-members-list input[type="checkbox"]:checked');
    const teamMemberIds = Array.from(teamCheckboxes).map(cb => parseInt(cb.value));
    
    if (teamMemberIds.length === 0) {
        showToast('Please select at least one team member', 'error');
        return;
    }
    
    const projectData = {
        project_name: document.getElementById('project-name').value,
        description: document.getElementById('project-description').value,
        technology_stack: document.getElementById('tech-stack').value,
        repository_url: document.getElementById('repo-url').value,
        team_member_ids: teamMemberIds
    };
    
    try {
        const result = await apiCall('/submissions', {
            method: 'POST',
            body: JSON.stringify(projectData)
        });
        
        showToast('Project submitted successfully!', 'success');
        e.target.reset();
        teamCheckboxes.forEach(cb => cb.checked = false);
        loadSubmissions();
        
    } catch (error) {
        showToast(`Failed to submit project: ${error.message}`, 'error');
    }
});

async function deleteSubmission(id) {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    
    try {
        await apiCall(`/submissions/${id}`, { method: 'DELETE' });
        showToast('Submission deleted', 'success');
        loadSubmissions();
    } catch (error) {
        showToast(`Failed to delete: ${error.message}`, 'error');
    }
}

// ==================== REGISTER EVENT (Student 2) ====================

async function loadEventsForRegistration() {
    try {
        const data = await apiCall('/registrations/events');
        
        const selectHtml = data.data.map(e => 
            `<option value="${e.event_id}">${e.name} (${e.event_type}) - ${new Date(e.start_date).toLocaleDateString()} [${e.current_registrations}/${e.max_participants}]</option>`
        ).join('');
        
        document.getElementById('event-select').innerHTML = 
            '<option value="">-- Select an Event --</option>' + selectHtml;
            
    } catch (error) {
        console.error('Failed to load events:', error);
    }
}

// Load available participants when event is selected
document.getElementById('event-select').addEventListener('change', async (e) => {
    const eventId = e.target.value;
    const participantSelect = document.getElementById('participant-select');
    
    if (!eventId) {
        participantSelect.innerHTML = '<option value="">-- Select a Participant --</option>';
        return;
    }
    
    try {
        const data = await apiCall(`/registrations/available-participants/${eventId}`);
        
        const selectHtml = data.data.map(p => 
            `<option value="${p.person_id}">${p.first_name} ${p.last_name} (${p.email})</option>`
        ).join('');
        
        participantSelect.innerHTML = 
            '<option value="">-- Select a Participant --</option>' + selectHtml;
            
    } catch (error) {
        console.error('Failed to load participants:', error);
    }
});

async function loadRegistrations() {
    try {
        const data = await apiCall('/registrations');
        
        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Reg. Number</th>
                            <th>Participant</th>
                            <th>Event</th>
                            <th>Ticket Type</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(r => `
                            <tr>
                                <td>${r.registration_number}</td>
                                <td>${r.first_name} ${r.last_name}</td>
                                <td>${r.event_name}</td>
                                <td>${r.ticket_type}</td>
                                <td><span class="badge ${r.payment_status === 'completed' ? 'badge-success' : 'badge-warning'}">${r.payment_status}</span></td>
                                <td>
                                    <button class="btn btn-danger btn-sm" onclick="cancelRegistration(${r.person_id}, ${r.event_id})">Cancel</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No registrations yet</p>';
        
        document.getElementById('registrations-list').innerHTML = tableHtml;
        
    } catch (error) {
        document.getElementById('registrations-list').innerHTML = '<p>Failed to load registrations</p>';
    }
}

// Register Event Form Handler
document.getElementById('register-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const registrationData = {
        person_id: parseInt(document.getElementById('participant-select').value),
        event_id: parseInt(document.getElementById('event-select').value),
        ticket_type: document.getElementById('ticket-type').value
    };
    
    try {
        const result = await apiCall('/registrations', {
            method: 'POST',
            body: JSON.stringify(registrationData)
        });
        
        showToast(`Registration successful! Number: ${result.registration_number}`, 'success');
        e.target.reset();
        loadEventsForRegistration();
        loadRegistrations();
        
    } catch (error) {
        showToast(`Failed to register: ${error.message}`, 'error');
    }
});

async function cancelRegistration(personId, eventId) {
    if (!confirm('Are you sure you want to cancel this registration?')) return;
    
    try {
        await apiCall(`/registrations/${personId}/${eventId}`, { method: 'DELETE' });
        showToast('Registration cancelled', 'success');
        loadRegistrations();
        loadEventsForRegistration();
    } catch (error) {
        showToast(`Failed to cancel: ${error.message}`, 'error');
    }
}

// ==================== ANALYTICS (Student 1) ====================

async function loadSubmissionAnalytics() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    
    try {
        const data = await apiCall(`/analytics/submissions?startDate=${startDate}&endDate=${endDate}`);
        
        // Summary
        const summaryHtml = `
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="value">${data.summary.totalRecords}</div>
                    <div class="label">Total Records</div>
                </div>
                <div class="summary-item">
                    <div class="value">${data.summary.uniqueSubmissions}</div>
                    <div class="label">Unique Submissions</div>
                </div>
                <div class="summary-item">
                    <div class="value">${data.summary.uniqueParticipants}</div>
                    <div class="label">Unique Participants</div>
                </div>
            </div>
            <h4>Technology Usage</h4>
            <p>${Object.entries(data.summary.technologyUsage).map(([tech, count]) => 
                `<span class="badge badge-info">${tech}: ${count}</span>`
            ).join(' ')}</p>
        `;
        document.getElementById('analytics-s1-summary').innerHTML = summaryHtml;
        
        // Table
        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Project</th>
                            <th>Participant</th>
                            <th>Email</th>
                            <th>Submitted</th>
                            <th>Days Since Reg</th>
                            <th>Total Submissions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(r => `
                            <tr>
                                <td>${r.submission_id}</td>
                                <td>${r.project_name}</td>
                                <td>${r.participant_first_name} ${r.participant_last_name}</td>
                                <td>${r.participant_email}</td>
                                <td>${new Date(r.submission_time).toLocaleString()}</td>
                                <td>${r.days_since_registration}</td>
                                <td>${r.total_submissions_by_participant}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No submissions found for the selected date range</p>';
        
        document.getElementById('analytics-s1-table').innerHTML = tableHtml;
        
    } catch (error) {
        showToast(`Failed to load analytics: ${error.message}`, 'error');
    }
}

// ==================== ANALYTICS (Student 2) ====================

async function loadRegistrationAnalytics() {
    const eventType = document.getElementById('filter-event-type').value;
    
    try {
        const data = await apiCall(`/analytics/registrations?eventType=${eventType}`);
        
        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Venue</th>
                            <th>Registrations</th>
                            <th>Capacity %</th>
                            <th>Paid</th>
                            <th>Pending</th>
                            <th>Participants</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(r => `
                            <tr>
                                <td>${r.event_name}</td>
                                <td>${r.event_type}</td>
                                <td>${new Date(r.start_date).toLocaleDateString()} - ${new Date(r.end_date).toLocaleDateString()}</td>
                                <td>${r.venue_name}</td>
                                <td>${r.total_registrations}/${r.max_participants}</td>
                                <td><span class="badge ${r.capacity_percentage > 80 ? 'badge-warning' : 'badge-success'}">${r.capacity_percentage}%</span></td>
                                <td>${r.paid_registrations}</td>
                                <td>${r.pending_payments}</td>
                                <td>${r.registered_participants || 'None'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No events found for the selected type</p>';
        
        document.getElementById('analytics-s2-table').innerHTML = tableHtml;
        
    } catch (error) {
        showToast(`Failed to load analytics: ${error.message}`, 'error');
    }
}

// ==================== DATA MANAGEMENT ====================

async function loadDbStats() {
    try {
        const data = await apiCall('/data/stats');
        
        const statsHtml = `
            <div class="summary-grid">
                ${Object.entries(data.stats).map(([table, count]) => `
                    <div class="summary-item">
                        <div class="value">${count}</div>
                        <div class="label">${table}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.getElementById('db-stats').innerHTML = statsHtml;
        
    } catch (error) {
        document.getElementById('db-stats').innerHTML = `
            <div style="color: #c53030; padding: 1rem; background: #fed7d7; border-radius: 6px;">
                <strong>Error:</strong> ${error.message}
                <br><br>
                <strong>Troubleshooting:</strong>
                <ol style="margin-top: 0.5rem; margin-left: 1.5rem;">
                    <li>Make sure Docker is running</li>
                    <li>Run: <code>docker-compose up --build</code></li>
                    <li>Wait for "Server running on port 3000" message</li>
                    <li>Check terminal for database connection errors</li>
                </ol>
            </div>
        `;
    }
}

// Import Data Button Handler
document.getElementById('import-data-btn').addEventListener('click', async () => {
    if (!confirm('This will replace ALL existing data with new randomized data. Are you sure?')) {
        return;
    }
    
    const btn = document.getElementById('import-data-btn');
    const statusDiv = document.getElementById('import-status');
    
    btn.disabled = true;
    btn.textContent = 'Importing...';
    statusDiv.innerHTML = '<p class="loading">Generating and importing data...</p>';
    
    try {
        const result = await apiCall('/data/import', { method: 'POST' });
        
        statusDiv.innerHTML = `
            <p class="badge badge-success">Data imported successfully!</p>
            <div class="summary-grid" style="margin-top: 1rem;">
                ${Object.entries(result.stats).map(([key, value]) => `
                    <div class="summary-item">
                        <div class="value">${value}</div>
                        <div class="label">${key}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        showToast('Data imported successfully!', 'success');
        loadDbStats();
        
    } catch (error) {
        statusDiv.innerHTML = `<p class="badge badge-error">Import failed: ${error.message}</p>`;
        showToast(`Import failed: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Import Data (Replace Existing)';
    }
});

// NoSQL Migration Button Handler
document.getElementById('migrate-nosql-btn').addEventListener('click', async () => {
    if (!confirm('This will clear MongoDB collections and migrate data from MySQL. Continue?')) {
        return;
    }

    const btn = document.getElementById('migrate-nosql-btn');
    const statusDiv = document.getElementById('migrate-status');

    btn.disabled = true;
    btn.textContent = 'Migrating...';
    statusDiv.innerHTML = '<p class="loading">Migrating data to MongoDB...</p>';

    try {
        const result = await apiCall('/nosql/migrate', { method: 'POST' });
        statusDiv.innerHTML = `
            <p class="badge badge-success">Migration complete!</p>
            <div class="summary-grid" style="margin-top: 1rem;">
                ${Object.entries(result.stats).map(([key, value]) => `
                    <div class="summary-item">
                        <div class="value">${value}</div>
                        <div class="label">${key}</div>
                    </div>
                `).join('')}
            </div>
        `;
        showToast('MongoDB migration completed!', 'success');
    } catch (error) {
        statusDiv.innerHTML = `<p class="badge badge-error">Migration failed: ${error.message}</p>`;
        showToast(`Migration failed: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Migrate to MongoDB';
    }
});

// ==================== INITIALIZATION ====================

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});
